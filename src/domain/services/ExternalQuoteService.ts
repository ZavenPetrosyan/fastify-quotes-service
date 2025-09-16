import { Quote } from '../models/Quote';

export interface ExternalQuoteService {
  fetchRandomQuote(): Promise<Quote>;
}