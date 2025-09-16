export const typeDefs = `
  type Quote {
    id: String!
    content: String!
    author: String!
    tags: [String!]!
    length: Int
    dateAdded: String
    dateModified: String
    likes: Int!
    likedByCurrentUser: Boolean!
    popularityScore: Float!
    trendingScore: Float!
    similarQuotes(limit: Int = 3): [Quote!]!
  }

  type QuoteCollection {
    id: String!
    name: String!
    description: String
    quotes: [Quote!]!
    createdAt: String!
    updatedAt: String!
    isPublic: Boolean!
    likes: Int!
  }

  type UserPreferences {
    userId: String!
    favoriteAuthors: [String!]!
    favoriteTags: [String!]!
    likedQuotes: [String!]!
    collections: [QuoteCollection!]!
    createdAt: String!
  }

  type QuoteAnalytics {
    totalQuotes: Int!
    totalLikes: Int!
    mostLikedQuote: Quote
    trendingQuotes(limit: Int = 5): [Quote!]!
    popularAuthors(limit: Int = 5): [AuthorStats!]!
    recentActivity: [ActivityEvent!]!
  }

  type AuthorStats {
    author: String!
    quoteCount: Int!
    totalLikes: Int!
    averageLikes: Float!
  }

  type ActivityEvent {
    type: String!
    quoteId: String!
    userId: String
    timestamp: String!
    details: String
  }

  type QuoteComparison {
    quotes: [Quote!]!
    similarities: [SimilarityMetric!]!
    differences: [DifferenceMetric!]!
    recommendation: String!
  }

  type SimilarityMetric {
    field: String!
    score: Float!
    description: String!
  }

  type DifferenceMetric {
    field: String!
    quote1Value: String!
    quote2Value: String!
    description: String!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    version: String!
    uptime: Float!
    memory: MemoryStats!
  }

  type MemoryStats {
    used: Float!
    total: Float!
    percentage: Float!
  }

  type LikeResult {
    success: Boolean!
    newLikeCount: Int!
  }

  type CollectionResult {
    success: Boolean!
    collection: QuoteCollection
  }

  type RecommendationResult {
    quotes: [Quote!]!
    reason: String!
    confidence: Float!
  }

  input QuoteFilter {
    author: String
    tags: [String!]
    minLength: Int
    maxLength: Int
    minLikes: Int
    dateRange: DateRange
  }

  input DateRange {
    start: String!
    end: String!
  }

  input SortOptions {
    field: String!
    direction: String!
  }

  type Query {
    # Basic queries
    health: HealthStatus!
    randomQuote(userId: String): Quote!
    quote(id: String!, userId: String): Quote
    
    # Advanced queries
    quotes(
      filter: QuoteFilter
      sort: SortOptions
      limit: Int = 10
      offset: Int = 0
      userId: String
    ): [Quote!]!
    
    similarQuotes(id: String!, limit: Int = 5, userId: String): [Quote!]!
    searchQuotes(query: String, limit: Int = 10, userId: String): [Quote!]!
    
    # Analytics
    analytics: QuoteAnalytics!
    trendingQuotes(limit: Int = 10, timeRange: String = "24h"): [Quote!]!
    popularAuthors(limit: Int = 10): [AuthorStats!]!
    
    # Collections
    collections(userId: String!): [QuoteCollection!]!
    collection(id: String!, userId: String!): QuoteCollection
    
    # User preferences
    userPreferences(userId: String!): UserPreferences
    
    # Advanced features
    compareQuotes(quoteIds: [String!]!): QuoteComparison!
    recommendQuotes(userId: String!, limit: Int = 5): RecommendationResult!
    quoteHistory(userId: String!, limit: Int = 20): [Quote!]!
  }

  type Mutation {
    # Basic mutations
    likeQuote(quoteId: String!, userId: String!): LikeResult!
    unlikeQuote(quoteId: String!, userId: String!): LikeResult!
    
    # Collections
    createCollection(
      name: String!
      description: String
      isPublic: Boolean = false
      userId: String!
    ): CollectionResult!
    
    addQuoteToCollection(
      collectionId: String!
      quoteId: String!
      userId: String!
    ): CollectionResult!
    
    removeQuoteFromCollection(
      collectionId: String!
      quoteId: String!
      userId: String!
    ): CollectionResult!
    
    deleteCollection(collectionId: String!, userId: String!): CollectionResult!
    
    # User preferences
    updateUserPreferences(
      userId: String!
      favoriteAuthors: [String!]
      favoriteTags: [String!]
    ): UserPreferences!
    
    # Advanced mutations
    shareQuote(quoteId: String!, userId: String!): String!
    reportQuote(quoteId: String!, reason: String!, userId: String!): Boolean!
  }

  type Subscription {
    quoteLiked(quoteId: String!): Quote!
    newQuoteAdded: Quote!
    trendingQuotesUpdated: [Quote!]!
    userActivity(userId: String!): ActivityEvent!
  }
`;