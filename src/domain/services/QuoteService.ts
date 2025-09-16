import { QuoteWithStats } from '../models/Quote';

export interface QuoteService {
  getRandomQuote(userId?: string): Promise<QuoteWithStats>;
  getQuoteById(id: string, userId?: string): Promise<QuoteWithStats | null>;
  likeQuote(quoteId: string, userId: string): Promise<void>;
  unlikeQuote(quoteId: string, userId: string): Promise<void>;
  getSimilarQuotes(quoteId: string, limit: number, userId?: string): Promise<QuoteWithStats[]>;
  searchQuotes(query?: string, limit?: number, userId?: string): Promise<QuoteWithStats[]>;
  
  getQuotesWithFilter(
    filter?: any,
    sort?: any,
    limit?: number,
    offset?: number,
    userId?: string
  ): Promise<QuoteWithStats[]>;
  
  getAnalytics(): Promise<any>;
  getAnalyticsDashboard(timeRange?: string, userId?: string): Promise<any>;
  getTrendingQuotes(limit?: number, timeRange?: string): Promise<QuoteWithStats[]>;
  getPopularAuthors(limit?: number): Promise<any[]>;
  discoverPatterns(patternType?: string, timeRange?: string, userId?: string): Promise<any>;
  
  getUserCollections(userId: string): Promise<any[]>;
  getCollection(id: string, userId: string): Promise<any>;
  createCollection(
    name: string,
    description: string | undefined,
    isPublic: boolean | undefined,
    userId: string
  ): Promise<any>;
  addQuoteToCollection(collectionId: string, quoteId: string, userId: string): Promise<any>;
  removeQuoteFromCollection(collectionId: string, quoteId: string, userId: string): Promise<any>;
  deleteCollection(collectionId: string, userId: string): Promise<void>;
  getUserPreferences(userId: string): Promise<any>;
  updateUserPreferences(userId: string, favoriteAuthors?: string[], favoriteTags?: string[]): Promise<any>;
  
  compareQuotes(quoteIds: string[], includeMetrics?: boolean): Promise<any>;
  getSmartRecommendations(
    userId: string,
    limit?: number,
    algorithm?: string,
    includeExplanation?: boolean
  ): Promise<any>;
  getQuoteHistory(userId: string, limit?: number): Promise<QuoteWithStats[]>;
  getLiveFeed(userId?: string, limit?: number, feedType?: string, includeActivity?: boolean): Promise<any>;
  
  shareQuote(quoteId: string, userId: string): Promise<string>;
  reportQuote(quoteId: string, reason: string, userId: string): Promise<boolean>;
}