import { QuoteRepository } from '../../domain/repositories/QuoteRepository';
import { Quote, QuoteLike } from '../../domain/models/Quote';

export class InMemoryQuoteRepository implements QuoteRepository {
  private quotes: Map<string, Quote> = new Map();
  private likes: Map<string, QuoteLike[]> = new Map();

  async getRandomQuote(): Promise<Quote | null> {
    const quotesArray = Array.from(this.quotes.values());
    if (quotesArray.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * quotesArray.length);
    return quotesArray[randomIndex] || null;
  }

  async getQuoteById(id: string): Promise<Quote | null> {
    return this.quotes.get(id) || null;
  }

  async getAllQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values());
  }

  async saveQuote(quote: Quote): Promise<void> {
    this.quotes.set(quote.id, quote);
  }

  async getLikesByQuoteId(quoteId: string): Promise<QuoteLike[]> {
    return this.likes.get(quoteId) || [];
  }

  async getUserLikeForQuote(quoteId: string, userId: string): Promise<QuoteLike | null> {
    const quoteLikes = this.likes.get(quoteId) || [];
    return quoteLikes.find(like => like.userId === userId) || null;
  }

  async addLike(like: QuoteLike): Promise<void> {
    const quoteLikes = this.likes.get(like.quoteId) || [];
    
    const existingLikeIndex = quoteLikes.findIndex(l => l.userId === like.userId);
    if (existingLikeIndex === -1) {
      quoteLikes.push(like);
      this.likes.set(like.quoteId, quoteLikes);
    }
  }

  async removeLike(quoteId: string, userId: string): Promise<void> {
    const quoteLikes = this.likes.get(quoteId) || [];
    const filteredLikes = quoteLikes.filter(like => like.userId !== userId);
    this.likes.set(quoteId, filteredLikes);
  }

  async getQuotesByIds(ids: string[]): Promise<Quote[]> {
    const quotes: Quote[] = [];
    for (const id of ids) {
      const quote = this.quotes.get(id);
      if (quote) {
        quotes.push(quote);
      }
    }
    return quotes;
  }

  getQuoteCount(): number {
    return this.quotes.size;
  }

  getLikeCount(): number {
    let total = 0;
    for (const likes of this.likes.values()) {
      total += likes.length;
    }
    return total;
  }
}