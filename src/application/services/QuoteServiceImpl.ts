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
      popularityScore: 0,
      trendingScore: 0,
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

  // Stub implementations for new interface methods
  async getQuotesWithFilter(filter?: any, sort?: any, limit?: number, offset?: number, userId?: string): Promise<QuoteWithStats[]> {
    return this.searchQuotes(undefined, limit, userId);
  }

  async getAnalytics(): Promise<any> {
    return { totalQuotes: 0, totalLikes: 0, mostLikedQuote: null, trendingQuotes: [], popularAuthors: [], recentActivity: [] };
  }

  async getAnalyticsDashboard(timeRange?: string, userId?: string): Promise<any> {
    return { overview: {}, trending: {}, engagement: {} };
  }

  async getTrendingQuotes(limit?: number, timeRange?: string): Promise<QuoteWithStats[]> {
    return [];
  }

  async getPopularAuthors(limit?: number): Promise<any[]> {
    return [];
  }

  async discoverPatterns(patternType?: string, timeRange?: string, userId?: string): Promise<any> {
    return { patternType: patternType || 'engagement', insights: [], recommendations: [], generatedAt: new Date().toISOString() };
  }

  async getUserCollections(userId: string): Promise<any[]> {
    return [];
  }

  async getCollection(id: string, userId: string): Promise<any> {
    throw new Error('Collection not found');
  }

  async createCollection(name: string, description: string | undefined, isPublic: boolean | undefined, userId: string): Promise<any> {
    return { id: 'stub', name, description, quotes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isPublic: isPublic || false, likes: 0, userId };
  }

  async addQuoteToCollection(collectionId: string, quoteId: string, userId: string): Promise<any> {
    return this.createCollection('stub', undefined, false, userId);
  }

  async removeQuoteFromCollection(collectionId: string, quoteId: string, userId: string): Promise<any> {
    return this.createCollection('stub', undefined, false, userId);
  }

  async deleteCollection(collectionId: string, userId: string): Promise<void> {
    // Stub implementation
  }

  async getUserPreferences(userId: string): Promise<any> {
    return { userId, favoriteAuthors: [], favoriteTags: [], likedQuotes: [], createdAt: new Date().toISOString() };
  }

  async updateUserPreferences(userId: string, favoriteAuthors?: string[], favoriteTags?: string[]): Promise<any> {
    return this.getUserPreferences(userId);
  }

  async compareQuotes(quoteIds: string[], analysisType?: string, includeMetrics?: boolean): Promise<any> {
    return { quotes: [], analysis: { similarities: [], differences: [], recommendation: 'Stub implementation', overallSimilarity: 0 } };
  }

  async getSmartRecommendations(userId: string, limit?: number, algorithm?: string, includeExplanation?: boolean): Promise<any> {
    return { recommendations: [], algorithm: algorithm || 'stub', reason: 'Stub implementation' };
  }

  async getQuoteHistory(userId: string, limit?: number): Promise<QuoteWithStats[]> {
    return [];
  }

  async getLiveFeed(userId?: string, limit?: number, feedType?: string, includeActivity?: boolean): Promise<any> {
    return { feed: [], feedType: feedType || 'stub', lastUpdated: new Date().toISOString(), nextUpdate: new Date().toISOString() };
  }

  async shareQuote(quoteId: string, userId: string): Promise<string> {
    return `https://quotes-service.com/share/stub-${quoteId}`;
  }

  async reportQuote(quoteId: string, reason: string, userId: string): Promise<boolean> {
    return true;
  }
}