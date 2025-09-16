import { Quote, QuoteLike } from '../models/Quote';

export interface QuoteRepository {
  getRandomQuote(): Promise<Quote | null>;
  getQuoteById(id: string): Promise<Quote | null>;
  getAllQuotes(): Promise<Quote[]>;
  saveQuote(quote: Quote): Promise<void>;
  getLikesByQuoteId(quoteId: string): Promise<QuoteLike[]>;
  getUserLikeForQuote(quoteId: string, userId: string): Promise<QuoteLike | null>;
  addLike(like: QuoteLike): Promise<void>;
  removeLike(quoteId: string, userId: string): Promise<void>;
  getQuotesByIds(ids: string[]): Promise<Quote[]>;
}