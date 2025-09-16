export const APP_CONSTANTS = {
  ENDPOINTS: {
    HEALTH: '/healthz',
    QUOTES: '/api/quotes',
    ANALYTICS: '/api/analytics',
    RECOMMENDATIONS: '/api/recommendations',
    INSIGHTS: '/api/insights',
    FEED: '/api/feed',
    DOCS: '/docs',
    GRAPHQL: '/graphql',
  },
  
  SWAGGER: {
    TITLE: 'Fastify Quotes Service',
    DESCRIPTION: 'A TypeScript web service built with Fastify for serving random quotes',
    VERSION: '1.0.0',
    SCHEMES: ['http'] as string[],
    CONSUMES: ['application/json'] as string[],
    PRODUCES: ['application/json'] as string[],
    TAGS: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'quotes', description: 'Quote management endpoints' },
      { name: 'analytics', description: 'Advanced analytics and insights' },
      { name: 'recommendations', description: 'Smart recommendation engine' },
      { name: 'insights', description: 'Pattern discovery and insights' },
      { name: 'feed', description: 'Real-time quote feeds' },
    ] as Array<{ name: string; description: string }>,
  },
  
  GRAPHQL: {
    PATH: '/graphql',
    ENABLED: true,
    ROUTES: true,
    IDE: true,
    BATCHED_QUERIES: true,
    SUBSCRIPTION: true,
  },
} as const;
