import { QuoteService } from '../../domain/services/QuoteService';
import { QuoteRepository } from '../../domain/repositories/QuoteRepository';
import { ExternalQuoteService } from '../../domain/services/ExternalQuoteService';
import { Quote, QuoteWithStats, QuoteLike } from '../../domain/models/Quote';

export class QuoteServiceImpl implements QuoteService {
  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly externalQuoteService: ExternalQuoteService
  ) {}

  async getRandomQuote(userId?: string): Promise<QuoteWithStats> {
    let quote = await this.quoteRepository.getRandomQuote();
    
    if (!quote || Math.random() < 0.3) {
      try {
        const externalQuote = await this.externalQuoteService.fetchRandomQuote();
        await this.quoteRepository.saveQuote(externalQuote);
        quote = externalQuote;
      } catch (error) {
        if (!quote) {
          throw new Error('Failed to fetch quote from external service and no local quotes available');
        }
      }
    }

    const prioritizedQuote = await this.getPrioritizedQuote(userId);
    if (prioritizedQuote && Math.random() < 0.7) {
      quote = prioritizedQuote;
    }

    return this.enrichQuoteWithStats(quote, userId);
  }

  async getQuoteById(id: string, userId?: string): Promise<QuoteWithStats | null> {
    const quote = await this.quoteRepository.getQuoteById(id);
    if (!quote) {
      return null;
    }
    
    return this.enrichQuoteWithStats(quote, userId);
  }

  async likeQuote(quoteId: string, userId: string): Promise<void> {
    const quote = await this.quoteRepository.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    const existingLike = await this.quoteRepository.getUserLikeForQuote(quoteId, userId);
    if (existingLike) {
      return;
    }

    const like: QuoteLike = {
      quoteId,
      userId,
      timestamp: new Date(),
    };

    await this.quoteRepository.addLike(like);
  }

  async unlikeQuote(quoteId: string, userId: string): Promise<void> {
    await this.quoteRepository.removeLike(quoteId, userId);
  }

  async getSimilarQuotes(quoteId: string, limit: number, userId?: string): Promise<QuoteWithStats[]> {
    const targetQuote = await this.quoteRepository.getQuoteById(quoteId);
    if (!targetQuote) {
      return [];
    }

    const allQuotes = await this.quoteRepository.getAllQuotes();
    const similarities = allQuotes
      .filter(q => q.id !== quoteId)
      .map(quote => ({
        quote,
        similarity: this.calculateSimilarity(targetQuote, quote),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    const enrichedQuotes = await Promise.all(
      similarities.map(({ quote }) => this.enrichQuoteWithStats(quote, userId))
    );

    return enrichedQuotes;
  }

  async searchQuotes(query?: string, limit: number = 10, userId?: string): Promise<QuoteWithStats[]> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    
    let filteredQuotes = allQuotes;
    if (query && query.trim().length > 0) {
      const searchTerm = query.toLowerCase().trim();
      filteredQuotes = allQuotes.filter(quote => 
        quote.content.toLowerCase().includes(searchTerm) ||
        quote.author.toLowerCase().includes(searchTerm) ||
        quote.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    const quotesWithLikes = await Promise.all(
      filteredQuotes.map(async quote => {
        const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
        return { quote, likesCount: likes.length };
      })
    );

    quotesWithLikes.sort((a, b) => b.likesCount - a.likesCount);
    
    const limitedQuotes = quotesWithLikes.slice(0, limit);
    
    return Promise.all(
      limitedQuotes.map(({ quote }) => this.enrichQuoteWithStats(quote, userId))
    );
  }

  private async enrichQuoteWithStats(quote: Quote, userId?: string): Promise<QuoteWithStats> {
    const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
    const likedByCurrentUser = userId ? 
      await this.quoteRepository.getUserLikeForQuote(quote.id, userId) !== null : 
      false;

    return {
      ...quote,
      likes: likes.length,
      likedByCurrentUser,
    };
  }

  private async getPrioritizedQuote(userId?: string): Promise<Quote | null> {
    if (!userId) {
      return null;
    }

    const allQuotes = await this.quoteRepository.getAllQuotes();
    if (allQuotes.length === 0) {
      return null;
    }

    const quotesWithLikes = await Promise.all(
      allQuotes.map(async quote => {
        const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
        return { quote, likesCount: likes.length };
      })
    );

    quotesWithLikes.sort((a, b) => b.likesCount - a.likesCount);
    
    const topQuotes = quotesWithLikes.slice(0, Math.min(5, quotesWithLikes.length));
    
    if (topQuotes.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * topQuotes.length);
    return topQuotes[randomIndex]?.quote || null;
  }

  private calculateSimilarity(quote1: Quote, quote2: Quote): number {
    const words1 = this.extractWords(quote1.content);
    const words2 = this.extractWords(quote2.content);
    
    const authorMatch = quote1.author.toLowerCase() === quote2.author.toLowerCase() ? 0.3 : 0;
    
    const tagIntersection = quote1.tags.filter(tag => 
      quote2.tags.some(tag2 => tag2.toLowerCase() === tag.toLowerCase())
    ).length;
    const tagSimilarity = (tagIntersection / Math.max(quote1.tags.length, quote2.tags.length, 1)) * 0.2;
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const wordSimilarity = (commonWords / Math.max(words1.length, words2.length, 1)) * 0.5;
    
    return authorMatch + tagSimilarity + wordSimilarity;
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }
}