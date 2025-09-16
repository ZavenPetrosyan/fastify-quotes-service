export const INFRASTRUCTURE_CONSTANTS = {
  EXTERNAL_APIS: {
    QUOTABLE_URL: 'https://api.quotable.io/random',
    DUMMYJSON_URL: 'https://dummyjson.com/quotes/random',
  },
  
  TIMEOUTS: {
    EXTERNAL_API: 5000,
    FEED_UPDATE_INTERVAL: 5 * 60 * 1000,
  },
  
  SECURITY: {
    CORS_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] as string[],
    CSP_DEFAULT_SRC: ["'self'"] as string[],
    CSP_STYLE_SRC: ["'self'", "'unsafe-inline'"] as string[],
    CSP_SCRIPT_SRC: ["'self'"] as string[],
    CSP_IMG_SRC: ["'self'", "data:", "https:"] as string[],
  },
  
  RATE_LIMIT: {
    MAX: 100,
    TIME_WINDOW: '1 minute',
  },
  
  SHARE: {
    BASE_URL: 'https://quotes-service.com/share',
  },
} as const;
