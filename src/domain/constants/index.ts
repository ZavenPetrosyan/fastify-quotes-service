export const DOMAIN_CONSTANTS = {
  ERRORS: {
    QUOTE_NOT_FOUND: 'Quote not found',
    COLLECTION_NOT_FOUND: 'Collection not found',
    EXTERNAL_API_FAILED: 'Failed to fetch quote from external service and no local quotes available',
    QUOTE_COMPARISON_MIN: 'At least 2 valid quotes required for comparison',
  },
  
  ACTIVITY: {
    NEW_QUOTE_ADDED: 'NEW_QUOTE_ADDED',
    QUOTE_LIKED: 'QUOTE_LIKED',
    QUOTE_UNLIKED: 'QUOTE_UNLIKED',
    QUOTE_SHARED: 'QUOTE_SHARED',
    QUOTE_REPORTED: 'QUOTE_REPORTED',
  },
  
  SCORING: {
    POPULARITY_DIVISOR: 10,
    TRENDING_DIVISOR: 5,
    AUTHOR_MATCH_WEIGHT: 0.3,
    TAG_SIMILARITY_WEIGHT: 0.2,
    WORD_SIMILARITY_WEIGHT: 0.5,
    CONTENT_SIMILARITY_WEIGHT: 0.6,
    PREFERENCE_AUTHOR_WEIGHT: 0.3,
    PREFERENCE_TAG_WEIGHT: 0.2,
    TRENDING_SCORE: 0.8,
    TRENDING_CONFIDENCE: 0.9,
  },
  
  TEXT: {
    MIN_WORD_LENGTH: 2,
    WORD_REGEX: /[^\w\s]/g,
    WHITESPACE_REGEX: /\s+/,
    POSITIVE_WORDS: [
      'love', 'happy', 'joy', 'success', 'beautiful', 'amazing', 
      'wonderful', 'great', 'excellent', 'fantastic'
    ],
    NEGATIVE_WORDS: [
      'hate', 'sad', 'pain', 'failure', 'ugly', 'terrible', 
      'awful', 'horrible', 'bad', 'worst'
    ],
  },
  
  TIME_RANGES: {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': Number.MAX_SAFE_INTEGER,
  },
  
  LIMITS: {
    MAX_QUOTES_COMPARISON: 5,
    MAX_RECOMMENDATIONS: 20,
    MAX_QUOTES_FILTER: 100,
    MAX_ACTIVITY_LOG: 20,
    MAX_TOP_TAGS: 10,
    MAX_QUOTE_ACTIVITY: 5,
    DEFAULT_ANALYTICS_LIMIT: 10,
    DEFAULT_RECOMMENDATION_LIMIT: 5,
    DEFAULT_FEED_LIMIT: 10,
    DEFAULT_TIME_RANGE: '24h',
    DEFAULT_PATTERN_TYPE: 'engagement',
    DEFAULT_ALGORITHM: 'hybrid',
    DEFAULT_FEED_TYPE: 'personalized',
    DEFAULT_ANALYSIS_TYPE: 'comprehensive',
    DEFAULT_EXPLANATION: true,
    DEFAULT_PUBLIC: false,
  },
  
  ALGORITHMS: {
    COLLABORATIVE: 'collaborative',
    CONTENT_BASED: 'content-based',
    TRENDING: 'trending',
    HYBRID: 'hybrid',
  },
  
  PATTERNS: {
    ENGAGEMENT: 'engagement',
    SENTIMENT: 'sentiment',
    LENGTH: 'length',
  },
  
  FEED_TYPES: {
    TRENDING: 'trending',
    RECENT: 'recent',
    POPULAR: 'popular',
    PERSONALIZED: 'personalized',
  },
  
  SORT: {
    ASC: 'asc',
    DESC: 'desc',
  },
  
  ANALYSIS: {
    BASIC: 'basic',
    COMPREHENSIVE: 'comprehensive',
  },
} as const;
