import { Quote, QuoteWithStats } from '../models/Quote';

export interface QuoteService {
  getRandomQuote(userId?: string): Promise<QuoteWithStats>;
  getQuoteById(id: string, userId?: string): Promise<QuoteWithStats | null>;
  likeQuote(quoteId: string, userId: string): Promise<void>;
  unlikeQuote(quoteId: string, userId: string): Promise<void>;
  getSimilarQuotes(quoteId: string, limit: number, userId?: string): Promise<QuoteWithStats[]>;
  searchQuotes(query?: string, limit?: number, userId?: string): Promise<QuoteWithStats[]>;
}