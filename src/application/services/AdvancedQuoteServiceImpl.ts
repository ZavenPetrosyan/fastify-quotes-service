import { QuoteService } from '../../domain/services/QuoteService';
import { QuoteRepository } from '../../domain/repositories/QuoteRepository';
import { ExternalQuoteService } from '../../domain/services/ExternalQuoteService';
import { Quote, QuoteWithStats, QuoteLike } from '../../domain/models/Quote';
import { PubSub } from 'graphql-subscriptions';
import { DOMAIN_CONSTANTS } from '../../domain/constants';
import { INFRASTRUCTURE_CONSTANTS } from '../../infrastructure/constants';

interface UserPreferences {
  userId: string;
  favoriteAuthors: string[];
  favoriteTags: string[];
  likedQuotes: string[];
  createdAt: string;
}

interface QuoteCollection {
  id: string;
  name: string;
  description?: string;
  quotes: Quote[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  likes: number;
  userId: string;
}

interface ActivityEvent {
  type: string;
  quoteId: string;
  userId?: string;
  timestamp: string;
  details?: string;
}

export class AdvancedQuoteServiceImpl implements QuoteService {
  private userPreferences: Map<string, UserPreferences> = new Map();
  private collections: Map<string, QuoteCollection> = new Map();
  private activityLog: ActivityEvent[] = [];
  private shareLinks: Map<string, string> = new Map();
  private reports: Map<string, { quoteId: string; reason: string; userId: string; timestamp: string }[]> = new Map();

  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly externalQuoteService: ExternalQuoteService,
    private readonly pubsub?: PubSub
  ) {}

  async getRandomQuote(userId?: string): Promise<QuoteWithStats> {
    let quote = await this.quoteRepository.getRandomQuote();
    
    if (!quote || Math.random() < 0.3) {
      try {
        const externalQuote = await this.externalQuoteService.fetchRandomQuote();
        await this.quoteRepository.saveQuote(externalQuote);
        quote = externalQuote;
        this.publishActivity(DOMAIN_CONSTANTS.ACTIVITY.NEW_QUOTE_ADDED, { quote });
      } catch (error) {
        if (!quote) {
          throw new Error(DOMAIN_CONSTANTS.ERRORS.EXTERNAL_API_FAILED);
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
      throw new Error(DOMAIN_CONSTANTS.ERRORS.QUOTE_NOT_FOUND);
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
    this.publishActivity(DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED, { quoteId, userId });
  }

  async unlikeQuote(quoteId: string, userId: string): Promise<void> {
    await this.quoteRepository.removeLike(quoteId, userId);
    this.publishActivity(DOMAIN_CONSTANTS.ACTIVITY.QUOTE_UNLIKED, { quoteId, userId });
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

  async getQuotesWithFilter(
    filter?: any,
    sort?: any,
    limit: number = 10,
    offset: number = 0,
    userId?: string
  ): Promise<QuoteWithStats[]> {
    let quotes = await this.quoteRepository.getAllQuotes();

    if (filter) {
      if (filter.author) {
        quotes = quotes.filter(q => q.author.toLowerCase().includes(filter.author.toLowerCase()));
      }
      if (filter.tags && filter.tags.length > 0) {
        quotes = quotes.filter(q => 
          filter.tags.some((tag: string) => 
            q.tags.some(quoteTag => quoteTag.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }
      if (filter.minLength) {
        quotes = quotes.filter(q => (q.length || 0) >= filter.minLength);
      }
      if (filter.maxLength) {
        quotes = quotes.filter(q => (q.length || 0) <= filter.maxLength);
      }
      if (filter.minLikes) {
        const quotesWithLikes = await Promise.all(
          quotes.map(async quote => {
            const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
            return { quote, likesCount: likes.length };
          })
        );
        quotes = quotesWithLikes
          .filter(({ likesCount }) => likesCount >= filter.minLikes)
          .map(({ quote }) => quote);
      }
    }

    if (sort) {
      const field = sort.field;
      const direction = sort.direction === 'desc' ? -1 : 1;
      
      if (field === 'likes') {
        const quotesWithLikes = await Promise.all(
          quotes.map(async quote => {
            const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
            return { quote, likesCount: likes.length };
          })
        );
        quotes = quotesWithLikes
          .sort((a, b) => (a.likesCount - b.likesCount) * direction)
          .map(({ quote }) => quote);
      } else if (field === 'author') {
        quotes.sort((a, b) => a.author.localeCompare(b.author) * direction);
      } else if (field === 'length') {
        quotes.sort((a, b) => ((a.length || 0) - (b.length || 0)) * direction);
      }
    }

    const paginatedQuotes = quotes.slice(offset, offset + limit);
    
    return Promise.all(
      paginatedQuotes.map(quote => this.enrichQuoteWithStats(quote, userId))
    );
  }

  async getAnalytics(): Promise<any> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    const totalLikes = await this.getTotalLikes();
    
    const mostLikedQuote = await this.getMostLikedQuote();
    const trendingQuotes = await this.getTrendingQuotes(5);
    const popularAuthors = await this.getPopularAuthors(5);
    const recentActivity = this.activityLog.slice(-10).reverse();

    return {
      totalQuotes: allQuotes.length,
      totalLikes,
      mostLikedQuote,
      trendingQuotes,
      popularAuthors,
      recentActivity,
    };
  }

  async getAnalyticsDashboard(
    timeRange: string = DOMAIN_CONSTANTS.LIMITS.DEFAULT_TIME_RANGE
  ): Promise<any> {
    const analytics = await this.getAnalytics();
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    const recentActivity = this.activityLog
      .filter(event => new Date(event.timestamp) >= cutoffTime)
      .slice(-20)
      .reverse();

    const likesOverTime = this.generateLikesOverTime(timeRange);
    const topTags = await this.getTopTags();

    return {
      overview: {
        totalQuotes: analytics.totalQuotes,
        totalLikes: analytics.totalLikes,
        totalUsers: this.userPreferences.size,
        averageLikesPerQuote: analytics.totalQuotes > 0 ? analytics.totalLikes / analytics.totalQuotes : 0,
        quotesAddedToday: recentActivity.filter(e => e.type === DOMAIN_CONSTANTS.ACTIVITY.NEW_QUOTE_ADDED).length,
      },
      trending: {
        mostLikedQuotes: analytics.trendingQuotes,
        popularAuthors: analytics.popularAuthors,
      },
      engagement: {
        likesOverTime,
        topTags,
      },
    };
  }

  async getTrendingQuotes(
    limit: number = DOMAIN_CONSTANTS.LIMITS.DEFAULT_ANALYTICS_LIMIT,
    timeRange: string = DOMAIN_CONSTANTS.LIMITS.DEFAULT_TIME_RANGE
  ): Promise<QuoteWithStats[]> {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    const recentLikes = this.activityLog
      .filter(event => 
        event.type === DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED && 
        new Date(event.timestamp) >= cutoffTime
      );

    const quoteLikeCounts = new Map<string, number>();
    recentLikes.forEach(event => {
      const count = quoteLikeCounts.get(event.quoteId) || 0;
      quoteLikeCounts.set(event.quoteId, count + 1);
    });

    const trendingQuotes = Array.from(quoteLikeCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([quoteId]) => quoteId);

    const quotes = await Promise.all(
      trendingQuotes.map(id => this.getQuoteById(id))
    );

    return quotes.filter(quote => quote !== null) as QuoteWithStats[];
  }

  async getPopularAuthors(limit: number = DOMAIN_CONSTANTS.LIMITS.DEFAULT_ANALYTICS_LIMIT): Promise<any[]> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    const authorStats = new Map<string, { quoteCount: number; totalLikes: number }>();

    for (const quote of allQuotes) {
      const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
      const current = authorStats.get(quote.author) || { quoteCount: 0, totalLikes: 0 };
      authorStats.set(quote.author, {
        quoteCount: current.quoteCount + 1,
        totalLikes: current.totalLikes + likes.length,
      });
    }

    return Array.from(authorStats.entries())
      .map(([author, stats]) => ({
        author,
        quoteCount: stats.quoteCount,
        totalLikes: stats.totalLikes,
        averageLikes: stats.quoteCount > 0 ? stats.totalLikes / stats.quoteCount : 0,
      }))
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, limit);
  }

  async discoverPatterns(
    patternType: string = DOMAIN_CONSTANTS.LIMITS.DEFAULT_PATTERN_TYPE,
    timeRange: string = '7d'
  ): Promise<any> {
    const insights = [];
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    switch (patternType) {
      case DOMAIN_CONSTANTS.PATTERNS.ENGAGEMENT: {
        const recentLikes = this.activityLog
          .filter(event => 
            event.type === DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED && 
            new Date(event.timestamp) >= cutoffTime
          );
        
        const hourlyEngagement = this.getHourlyEngagement(recentLikes);
        insights.push({
          title: 'Peak Engagement Hours',
          description: `Most activity occurs between ${hourlyEngagement.peakHour}:00-${
            hourlyEngagement.peakHour + 1
          }:00`,
          confidence: 0.85,
          data: hourlyEngagement,
        });
        break;
      }

      case DOMAIN_CONSTANTS.PATTERNS.SENTIMENT: {
        const allQuotes = await this.quoteRepository.getAllQuotes();
        const sentimentAnalysis = this.analyzeSentiment(allQuotes);
        insights.push({
          title: 'Content Sentiment Trends',
          description: `${sentimentAnalysis.positivePercentage}% of quotes have positive sentiment`,
          confidence: 0.72,
          data: sentimentAnalysis,
        });
        break;
      }

      case DOMAIN_CONSTANTS.PATTERNS.LENGTH: {
        const quotesForLength = await this.quoteRepository.getAllQuotes();
        const lengthAnalysis = this.analyzeQuoteLengths(quotesForLength);
        insights.push({
          title: 'Optimal Quote Length',
          description: `Most liked quotes average ${lengthAnalysis.optimalLength} characters`,
          confidence: 0.78,
          data: lengthAnalysis,
        });
        break;
      }
    }

    return {
      patternType,
      insights,
      recommendations: this.generateRecommendations(patternType),
      generatedAt: new Date().toISOString(),
    };
  }

  async getUserCollections(userId: string): Promise<any[]> {
    return Array.from(this.collections.values())
      .filter(collection => collection.userId === userId);
  }

  async getCollection(id: string, userId: string): Promise<any> {
    const collection = this.collections.get(id);
    if (!collection || collection.userId !== userId) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.COLLECTION_NOT_FOUND);
    }
    return collection;
  }

  async createCollection(
    name: string,
    description: string | undefined,
    isPublic: boolean | undefined,
    userId: string
  ): Promise<any> {
    const id = this.generateId();
    const collection: QuoteCollection = {
      id,
      name,
      description,
      quotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: isPublic || DOMAIN_CONSTANTS.LIMITS.DEFAULT_PUBLIC,
      likes: 0,
      userId,
    };
    
    this.collections.set(id, collection);
    return collection;
  }

  async addQuoteToCollection(collectionId: string, quoteId: string, userId: string): Promise<any> {
    const collection = this.collections.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.COLLECTION_NOT_FOUND);
    }

    const quote = await this.quoteRepository.getQuoteById(quoteId);
    if (!quote) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.QUOTE_NOT_FOUND);
    }

    if (!collection.quotes.some(q => q.id === quoteId)) {
      collection.quotes.push(quote);
      collection.updatedAt = new Date().toISOString();
      this.collections.set(collectionId, collection);
    }

    return collection;
  }

  async removeQuoteFromCollection(collectionId: string, quoteId: string, userId: string): Promise<any> {
    const collection = this.collections.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.COLLECTION_NOT_FOUND);
    }

    collection.quotes = collection.quotes.filter(q => q.id !== quoteId);
    collection.updatedAt = new Date().toISOString();
    this.collections.set(collectionId, collection);

    return collection;
  }

  async deleteCollection(collectionId: string, userId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.COLLECTION_NOT_FOUND);
    }

    this.collections.delete(collectionId);
  }

  async getUserPreferences(userId: string): Promise<any> {
    let preferences = this.userPreferences.get(userId);
    if (!preferences) {
      preferences = {
        userId,
        favoriteAuthors: [],
        favoriteTags: [],
        likedQuotes: [],
        createdAt: new Date().toISOString(),
      };
      this.userPreferences.set(userId, preferences);
    }
    return preferences;
  }

  async updateUserPreferences(userId: string, favoriteAuthors?: string[], favoriteTags?: string[]): Promise<any> {
    const preferences = await this.getUserPreferences(userId);
    
    if (favoriteAuthors) {
      preferences.favoriteAuthors = favoriteAuthors;
    }
    if (favoriteTags) {
      preferences.favoriteTags = favoriteTags;
    }

    this.userPreferences.set(userId, preferences);
    return preferences;
  }

  async compareQuotes(
    quoteIds: string[],
    includeMetrics: boolean = true
  ): Promise<any> {
    const quotes = await Promise.all(
      quoteIds.map(id => this.quoteRepository.getQuoteById(id))
    );

    const validQuotes = quotes.filter(quote => quote !== null) as Quote[];
    if (validQuotes.length < 2) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.QUOTE_COMPARISON_MIN);
    }

    const similarities = this.calculateQuoteSimilarities(validQuotes);
    const differences = this.calculateQuoteDifferences(validQuotes);
    const recommendation = this.generateComparisonRecommendation(similarities);

    const result: any = {
      quotes: validQuotes,
      analysis: {
        similarities,
        differences,
        recommendation,
        overallSimilarity: this.calculateOverallSimilarity(similarities),
      },
    };

    if (includeMetrics) {
      result.metrics = this.calculateComparisonMetrics(validQuotes);
    }

    return result;
  }

  async getSmartRecommendations(
    userId: string,
    limit: number = DOMAIN_CONSTANTS.LIMITS.DEFAULT_RECOMMENDATION_LIMIT,
    algorithm: string = DOMAIN_CONSTANTS.LIMITS.DEFAULT_ALGORITHM,
    includeExplanation: boolean = DOMAIN_CONSTANTS.LIMITS.DEFAULT_EXPLANATION
  ): Promise<any> {
    const preferences = await this.getUserPreferences(userId);
    const allQuotes = await this.quoteRepository.getAllQuotes();
    const userLikedQuotes = await this.getUserLikedQuotes(userId);

    let recommendations: any[] = [];

    switch (algorithm) {
      case DOMAIN_CONSTANTS.ALGORITHMS.COLLABORATIVE: {
        recommendations = await this.getCollaborativeRecommendations(userId, allQuotes, limit);
        break;
      }
      case DOMAIN_CONSTANTS.ALGORITHMS.CONTENT_BASED: {
        recommendations = await this.getContentBasedRecommendations(preferences, allQuotes, userLikedQuotes, limit);
        break;
      }
      case DOMAIN_CONSTANTS.ALGORITHMS.TRENDING: {
        recommendations = await this.getTrendingRecommendations(limit);
        break;
      }
      case DOMAIN_CONSTANTS.ALGORITHMS.HYBRID:
      default: {
        const collaborative = await this.getCollaborativeRecommendations(userId, allQuotes, Math.ceil(limit / 2));
        const contentBased = await this.getContentBasedRecommendations(
          preferences,
          allQuotes,
          userLikedQuotes,
          Math.ceil(limit / 2)
        );
        recommendations = this.mergeRecommendations(collaborative, contentBased, limit);
        break;
      }
    }

    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        const quote = await this.enrichQuoteWithStats(rec.quote, userId);
        return {
          quote,
          score: rec.score,
          reason: includeExplanation ? rec.reason : undefined,
          confidence: rec.confidence,
        };
      })
    );

    return {
      recommendations: enrichedRecommendations,
      algorithm,
      reason: this.getRecommendationReason(algorithm),
    };
  }

  async getQuoteHistory(userId: string, limit: number = 20): Promise<QuoteWithStats[]> {
    const userActivity = this.activityLog
      .filter(event => event.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    const quoteIds = [...new Set(userActivity.map(event => event.quoteId))];
    const quotes = await Promise.all(
      quoteIds.map(id => this.getQuoteById(id))
    );

    return quotes.filter(quote => quote !== null) as QuoteWithStats[];
  }

  async getLiveFeed(
    userId?: string,
    limit: number = DOMAIN_CONSTANTS.LIMITS.DEFAULT_FEED_LIMIT,
    feedType: string = DOMAIN_CONSTANTS.LIMITS.DEFAULT_FEED_TYPE,
    includeActivity: boolean = true
  ): Promise<any> {
    let quotes: Quote[] = [];

    switch (feedType) {
      case DOMAIN_CONSTANTS.FEED_TYPES.TRENDING: {
        quotes = (await this.getTrendingQuotes(limit)).map(q => q as any);
        break;
      }
      case DOMAIN_CONSTANTS.FEED_TYPES.RECENT: {
        quotes = (await this.quoteRepository.getAllQuotes()).slice(-limit);
        break;
      }
      case DOMAIN_CONSTANTS.FEED_TYPES.POPULAR: {
        const allQuotes = await this.quoteRepository.getAllQuotes();
        const quotesWithLikes = await Promise.all(
          allQuotes.map(async quote => {
            const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
            return { quote, likesCount: likes.length };
          })
        );
        quotes = quotesWithLikes
          .sort((a, b) => b.likesCount - a.likesCount)
          .slice(0, limit)
          .map(({ quote }) => quote);
        break;
      }
      case DOMAIN_CONSTANTS.FEED_TYPES.PERSONALIZED:
      default: {
        if (userId) {
          const recommendations = await this.getSmartRecommendations(
            userId,
            limit,
            DOMAIN_CONSTANTS.ALGORITHMS.HYBRID,
            false
          );
          quotes = recommendations.recommendations.map((rec: any) => rec.quote);
        } else {
          quotes = (await this.quoteRepository.getAllQuotes()).slice(-limit);
        }
        break;
      }
    }

    const enrichedQuotes = await Promise.all(
      quotes.map(async quote => {
        const enriched = await this.enrichQuoteWithStats(quote, userId);
        const activity = includeActivity ? this.getQuoteActivity(quote.id) : undefined;
        return {
          quote: enriched,
          activity,
          relevanceScore: this.calculateRelevanceScore(quote, userId),
        };
      })
    );

    return {
      feed: enrichedQuotes,
      feedType,
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  async shareQuote(quoteId: string, userId: string): Promise<string> {
    const quote = await this.quoteRepository.getQuoteById(quoteId);
    if (!quote) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.QUOTE_NOT_FOUND);
    }

    const shareId = this.generateId();
    const shareUrl = `${INFRASTRUCTURE_CONSTANTS.SHARE.BASE_URL}/${shareId}`;
    this.shareLinks.set(shareId, quoteId);
    
    this.publishActivity(DOMAIN_CONSTANTS.ACTIVITY.QUOTE_SHARED, { quoteId, userId, shareId });
    return shareUrl;
  }

  async reportQuote(quoteId: string, reason: string, userId: string): Promise<boolean> {
    const quote = await this.quoteRepository.getQuoteById(quoteId);
    if (!quote) {
      throw new Error(DOMAIN_CONSTANTS.ERRORS.QUOTE_NOT_FOUND);
    }

    const report = {
      quoteId,
      reason,
      userId,
      timestamp: new Date().toISOString(),
    };

    const existingReports = this.reports.get(quoteId) || [];
    existingReports.push(report);
    this.reports.set(quoteId, existingReports);

    this.publishActivity(DOMAIN_CONSTANTS.ACTIVITY.QUOTE_REPORTED, { quoteId, userId, reason });
    return true;
  }

  private async enrichQuoteWithStats(quote: Quote, userId?: string): Promise<QuoteWithStats> {
    const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
    const likedByCurrentUser = userId ? 
      await this.quoteRepository.getUserLikeForQuote(quote.id, userId) !== null : 
      false;

    const popularityScore = this.calculatePopularityScore(likes.length);
    const trendingScore = this.calculateTrendingScore(quote.id);

    return {
      ...quote,
      likes: likes.length,
      likedByCurrentUser,
      popularityScore,
      trendingScore,
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
    
    const authorMatch = quote1.author.toLowerCase() === quote2.author.toLowerCase()
      ? DOMAIN_CONSTANTS.SCORING.AUTHOR_MATCH_WEIGHT
      : 0;
    
    const tagIntersection = quote1.tags.filter(tag => 
      quote2.tags.some(tag2 => tag2.toLowerCase() === tag.toLowerCase())
    ).length;
    const tagSimilarity = (tagIntersection / Math.max(quote1.tags.length, quote2.tags.length, 1)) *
      DOMAIN_CONSTANTS.SCORING.TAG_SIMILARITY_WEIGHT;
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const wordSimilarity = (commonWords / Math.max(words1.length, words2.length, 1)) *
      DOMAIN_CONSTANTS.SCORING.WORD_SIMILARITY_WEIGHT;
    
    return authorMatch + tagSimilarity + wordSimilarity;
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(DOMAIN_CONSTANTS.TEXT.WORD_REGEX, ' ')
      .split(DOMAIN_CONSTANTS.TEXT.WHITESPACE_REGEX)
      .filter(word => word.length > DOMAIN_CONSTANTS.TEXT.MIN_WORD_LENGTH);
  }

  private async getTotalLikes(): Promise<number> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    let total = 0;
    for (const quote of allQuotes) {
      const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
      total += likes.length;
    }
    return total;
  }

  private async getMostLikedQuote(): Promise<QuoteWithStats | null> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    let mostLiked: { quote: Quote; likes: number } | null = null;

    for (const quote of allQuotes) {
      const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
      if (!mostLiked || likes.length > mostLiked.likes) {
        mostLiked = { quote, likes: likes.length };
      }
    }

    return mostLiked ? this.enrichQuoteWithStats(mostLiked.quote) : null;
  }

  private getTimeRangeMs(timeRange: string): number {
    return DOMAIN_CONSTANTS.TIME_RANGES[timeRange as keyof typeof DOMAIN_CONSTANTS.TIME_RANGES] ||
      DOMAIN_CONSTANTS.TIME_RANGES['24h'];
  }

  private generateLikesOverTime(timeRange: string): any[] {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);
    const interval = timeRangeMs / 24;

    const likesOverTime = [];
    for (let i = 0; i < 24; i++) {
      const startTime = new Date(cutoffTime.getTime() + (i * interval));
      const endTime = new Date(cutoffTime.getTime() + ((i + 1) * interval));
      
      const likesInInterval = this.activityLog.filter(event => 
        event.type === DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED &&
        new Date(event.timestamp) >= startTime &&
        new Date(event.timestamp) < endTime
      ).length;

      likesOverTime.push({
        timestamp: startTime.toISOString(),
        count: likesInInterval,
      });
    }

    return likesOverTime;
  }

  private async getTopTags(): Promise<any[]> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    const tagCounts = new Map<string, { count: number; totalLikes: number }>();

    for (const quote of allQuotes) {
      const likes = await this.quoteRepository.getLikesByQuoteId(quote.id);
      for (const tag of quote.tags) {
        const current = tagCounts.get(tag) || { count: 0, totalLikes: 0 };
        tagCounts.set(tag, {
          count: current.count + 1,
          totalLikes: current.totalLikes + likes.length,
        });
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        averageLikes: stats.count > 0 ? stats.totalLikes / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, DOMAIN_CONSTANTS.LIMITS.MAX_TOP_TAGS);
  }

  private getHourlyEngagement(events: ActivityEvent[]): any {
    const hourlyCounts = new Array(24).fill(0);
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyCounts[hour]++;
    });

    const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
    return {
      hourlyCounts,
      peakHour,
      totalEvents: events.length,
    };
  }

  private analyzeSentiment(quotes: Quote[]): any {
    const positiveWords = DOMAIN_CONSTANTS.TEXT.POSITIVE_WORDS;
    const negativeWords = DOMAIN_CONSTANTS.TEXT.NEGATIVE_WORDS;

    let positiveCount = 0;
    let negativeCount = 0;

    quotes.forEach(quote => {
      const content = quote.content.toLowerCase();
      const positiveMatches = positiveWords.filter(word => content.includes(word)).length;
      const negativeMatches = negativeWords.filter(word => content.includes(word)).length;
      
      if (positiveMatches > negativeMatches) {
        positiveCount++;
      } else if (negativeMatches > positiveMatches) {
        negativeCount++;
      }
    });

    const total = quotes.length;
    return {
      positiveCount,
      negativeCount,
      neutralCount: total - positiveCount - negativeCount,
      positivePercentage: total > 0 ? (positiveCount / total) * 100 : 0,
      negativePercentage: total > 0 ? (negativeCount / total) * 100 : 0,
    };
  }

  private analyzeQuoteLengths(quotes: Quote[]): any {
    const lengths = quotes.map(q => q.length || q.content.length);
    const averageLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;

    const likedQuotes = quotes.filter(q => (q as any).likes > 0);
    const likedLengths = likedQuotes.map(q => q.length || q.content.length);
    const optimalLength = likedLengths.length > 0 
      ? likedLengths.reduce((sum, len) => sum + len, 0) / likedLengths.length 
      : averageLength;

    return {
      averageLength,
      optimalLength,
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      totalQuotes: quotes.length,
    };
  }

  private generateRecommendations(patternType: string): string[] {
    const recommendations = [];
    
    switch (patternType) {
      case DOMAIN_CONSTANTS.PATTERNS.ENGAGEMENT:
        recommendations.push('Consider posting new quotes during peak engagement hours');
        recommendations.push('Focus on quotes that generate discussion and interaction');
        break;
      case DOMAIN_CONSTANTS.PATTERNS.SENTIMENT:
        recommendations.push('Balance positive and inspirational content with thought-provoking quotes');
        recommendations.push('Consider the emotional impact of quote selection');
        break;
      case DOMAIN_CONSTANTS.PATTERNS.LENGTH:
        recommendations.push('Optimize quote length for better engagement');
        recommendations.push('Test different quote lengths to find the sweet spot');
        break;
    }

    return recommendations;
  }

  private calculatePopularityScore(likes: number): number {
    return Math.min(likes / DOMAIN_CONSTANTS.SCORING.POPULARITY_DIVISOR, 1.0);
  }

  private calculateTrendingScore(quoteId: string): number {
    const recentLikes = this.activityLog
      .filter(event => 
        event.type === DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED && 
        event.quoteId === quoteId &&
        new Date(event.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

    return Math.min(recentLikes / DOMAIN_CONSTANTS.SCORING.TRENDING_DIVISOR, 1.0);
  }

  private calculateQuoteSimilarities(quotes: Quote[]): any[] {
    const similarities = [];
    
    for (let i = 0; i < quotes.length; i++) {
      for (let j = i + 1; j < quotes.length; j++) {
        const similarity = this.calculateSimilarity(quotes[i], quotes[j]);
        similarities.push({
          field: 'content',
          score: similarity,
          description: `${
            similarity > 0.7 ? 'High' : similarity > 0.4 ? 'Medium' : 'Low'
          } similarity in content and themes`,
        });
      }
    }

    return similarities;
  }

  private calculateQuoteDifferences(quotes: Quote[]): any[] {
    const differences = [];
    
    const authors = [...new Set(quotes.map(q => q.author))];
    if (authors.length > 1) {
      differences.push({
        field: 'author',
        values: authors,
        description: `Quotes from ${authors.length} different authors`,
      });
    }

    const lengths = quotes.map(q => q.length || q.content.length);
    const lengthRange = Math.max(...lengths) - Math.min(...lengths);
    if (lengthRange > 50) {
      differences.push({
        field: 'length',
        values: lengths.map(l => `${l} chars`),
        description: `Significant variation in quote lengths (${Math.min(...lengths)}-${Math.max(
          ...lengths
        )} characters)`,
      });
    }

    return differences;
  }

  private generateComparisonRecommendation(similarities: any[]): string {
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim.score, 0) / similarities.length;
    
    if (avgSimilarity > 0.7) {
      return 'These quotes are very similar and would work well together in a themed collection.';
    } else if (avgSimilarity > 0.4) {
      return 'These quotes have moderate similarities and could complement each other in a diverse collection.';
    } else {
      return 'These quotes are quite different and would provide good variety in a collection.';
    }
  }

  private calculateOverallSimilarity(similarities: any[]): number {
    return similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim.score, 0) / similarities.length 
      : 0;
  }

  private calculateComparisonMetrics(quotes: Quote[]): any {
    const lengths = quotes.map(q => q.length || q.content.length);
    const allTags = quotes.flatMap(q => q.tags);
    const uniqueTags = [...new Set(allTags)];
    const authors = [...new Set(quotes.map(q => q.author))];

    return {
      averageLength: lengths.reduce((sum, len) => sum + len, 0) / lengths.length,
      averageLikes: 0,
      commonTags: uniqueTags.filter(tag => 
        quotes.filter(q => q.tags.includes(tag)).length > 1
      ),
      authorDiversity: authors.length / quotes.length,
    };
  }

  private async getCollaborativeRecommendations(userId: string, allQuotes: Quote[], limit: number): Promise<any[]> {
    const preferences = await this.getUserPreferences(userId);
    const userLikedQuotes = await this.getUserLikedQuotes(userId);
    
    const recommendations = allQuotes
      .filter(quote => !userLikedQuotes.includes(quote.id))
      .map(quote => {
        let score = 0;
        
        if (preferences.favoriteAuthors.includes(quote.author)) {
          score += DOMAIN_CONSTANTS.SCORING.PREFERENCE_AUTHOR_WEIGHT;
        }
        
        const matchingTags = quote.tags.filter(tag => 
          preferences.favoriteTags.includes(tag)
        ).length;
        score += (matchingTags / Math.max(quote.tags.length, 1)) * DOMAIN_CONSTANTS.SCORING.PREFERENCE_TAG_WEIGHT;
        
        return {
          quote,
          score,
          reason: `Based on your preferences for ${preferences.favoriteAuthors.join(
            ', '
          )} and tags: ${preferences.favoriteTags.join(', ')}`,
          confidence: Math.min(score, 1.0),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  }

  private async getContentBasedRecommendations(
    preferences: UserPreferences,
    allQuotes: Quote[],
    userLikedQuotes: string[],
    limit: number
  ): Promise<any[]> {
    const recommendations = allQuotes
      .filter(quote => !userLikedQuotes.includes(quote.id))
      .map(quote => {
        let score = 0;
        
        const contentScore = this.calculateContentSimilarity(quote, userLikedQuotes, allQuotes);
        score += contentScore * DOMAIN_CONSTANTS.SCORING.CONTENT_SIMILARITY_WEIGHT;
        
        if (preferences.favoriteAuthors.includes(quote.author)) {
          score += DOMAIN_CONSTANTS.SCORING.PREFERENCE_AUTHOR_WEIGHT;
        }
        
        return {
          quote,
          score,
          reason: 'Based on content similarity to your liked quotes',
          confidence: Math.min(score, 1.0),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  }

  private async getTrendingRecommendations(limit: number): Promise<any[]> {
    const trendingQuotes = await this.getTrendingQuotes(limit);
    return trendingQuotes.map(quote => ({
      quote,
      score: DOMAIN_CONSTANTS.SCORING.TRENDING_SCORE,
      reason: 'Currently trending quotes',
      confidence: DOMAIN_CONSTANTS.SCORING.TRENDING_CONFIDENCE,
    }));
  }

  private mergeRecommendations(collaborative: any[], contentBased: any[], limit: number): any[] {
    const combined = [...collaborative, ...contentBased];
    const unique = combined.filter((rec, index, self) => 
      index === self.findIndex(r => r.quote.id === rec.quote.id)
    );
    
    return unique
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getRecommendationReason(algorithm: string): string {
    switch (algorithm) {
      case DOMAIN_CONSTANTS.ALGORITHMS.COLLABORATIVE:
        return 'Based on similar users and your preferences';
      case DOMAIN_CONSTANTS.ALGORITHMS.CONTENT_BASED:
        return 'Based on content similarity to your liked quotes';
      case DOMAIN_CONSTANTS.ALGORITHMS.TRENDING:
        return 'Based on current trending quotes';
      case DOMAIN_CONSTANTS.ALGORITHMS.HYBRID:
        return 'Combining multiple recommendation strategies for optimal results';
      default:
        return 'Personalized recommendations';
    }
  }

  private async getUserLikedQuotes(userId: string): Promise<string[]> {
    const allQuotes = await this.quoteRepository.getAllQuotes();
    const likedQuotes: string[] = [];
    
    for (const quote of allQuotes) {
      const like = await this.quoteRepository.getUserLikeForQuote(quote.id, userId);
      if (like) {
        likedQuotes.push(quote.id);
      }
    }
    
    return likedQuotes;
  }

  private calculateContentSimilarity(quote: Quote, userLikedQuotes: string[], allQuotes: Quote[]): number {
    if (userLikedQuotes.length === 0) return 0;
    
    const likedQuotes = allQuotes.filter(q => userLikedQuotes.includes(q.id));
    const similarities = likedQuotes.map(likedQuote => 
      this.calculateSimilarity(quote, likedQuote)
    );
    
    return similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length 
      : 0;
  }

  private getQuoteActivity(quoteId: string): any {
    const activities = this.activityLog
      .filter(event => event.quoteId === quoteId)
      .slice(-5)
      .reverse();
    
    return activities.length > 0 ? activities[0] : null;
  }

  private calculateRelevanceScore(quote: Quote, userId?: string): number {
    if (!userId) return 0.5;
    
    const preferences = this.userPreferences.get(userId);
    if (!preferences) return 0.5;
    
    let score = 0.5;
    
    if (preferences.favoriteAuthors.includes(quote.author)) {
      score += DOMAIN_CONSTANTS.SCORING.PREFERENCE_AUTHOR_WEIGHT;
    }
    
    const matchingTags = quote.tags.filter(tag => 
      preferences.favoriteTags.includes(tag)
    ).length;
    score += (matchingTags / Math.max(quote.tags.length, 1)) * DOMAIN_CONSTANTS.SCORING.PREFERENCE_TAG_WEIGHT;
    
    return Math.min(score, 1.0);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private publishActivity(type: string, data: any): void {
    if (this.pubsub) {
      const event: ActivityEvent = {
        type,
        quoteId: data.quoteId || '',
        userId: data.userId,
        timestamp: new Date().toISOString(),
        details: data.details || JSON.stringify(data),
      };
      
      this.activityLog.push(event);
      
      if (type === DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED) {
        this.pubsub.publish(`${DOMAIN_CONSTANTS.ACTIVITY.QUOTE_LIKED}_${data.quoteId}`, { quoteLiked: data.quote });
      } else if (type === DOMAIN_CONSTANTS.ACTIVITY.NEW_QUOTE_ADDED) {
        this.pubsub.publish(DOMAIN_CONSTANTS.ACTIVITY.NEW_QUOTE_ADDED, { newQuoteAdded: data.quote });
      } else if (data.userId) {
        this.pubsub.publish(`USER_ACTIVITY_${data.userId}`, { userActivity: event });
      }
    }
  }
}
