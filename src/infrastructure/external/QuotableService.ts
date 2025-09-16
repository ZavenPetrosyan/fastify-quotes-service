// Using built-in fetch available in Node.js 18+
import { ExternalQuoteService } from '../../domain/services/ExternalQuoteService';
import { Quote, QuotableApiResponseSchema, DummyJsonResponseSchema } from '../../domain/models/Quote';

export class QuotableService implements ExternalQuoteService {
  private readonly quotableUrl = 'https://api.quotable.io/random';
  private readonly dummyJsonUrl = 'https://dummyjson.com/quotes/random';

  async fetchRandomQuote(): Promise<Quote> {
    try {
      const response = await fetch(this.quotableUrl);
      if (!response.ok) {
        throw new Error(`Quotable API error: ${response.status}`);
      }
      
      const data = await response.json();
      const parsed = QuotableApiResponseSchema.parse(data);
      
      return {
        id: parsed._id,
        content: parsed.content,
        author: parsed.author,
        tags: parsed.tags || [],
        length: parsed.length,
        dateAdded: parsed.dateAdded,
        dateModified: parsed.dateModified,
      };
    } catch (error) {
      console.warn('Quotable API failed, trying DummyJSON fallback:', error);
      return this.fetchFromDummyJson();
    }
  }

  private async fetchFromDummyJson(): Promise<Quote> {
    const response = await fetch(this.dummyJsonUrl);
    if (!response.ok) {
      throw new Error(`DummyJSON API error: ${response.status}`);
    }
    
    const data = await response.json();
    const parsed = DummyJsonResponseSchema.parse({ quotes: [data], total: 1, skip: 0, limit: 1 });
    const quote = parsed.quotes[0];
    
    if (!quote) {
      throw new Error('No quote received from DummyJSON API');
    }
    
    return {
      id: quote.id.toString(),
      content: quote.quote,
      author: quote.author,
      tags: [],
      length: quote.quote.length,
    };
  }
}