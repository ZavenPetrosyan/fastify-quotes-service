import { FastifyPluginAsync } from 'fastify';
import { QuoteService } from '../../../domain/services/QuoteService';

interface AnalyticsRouteOptions {
  quoteService: QuoteService;
}

const analyticsRoutes: FastifyPluginAsync<AnalyticsRouteOptions> = async (fastify, opts) => {
  const { quoteService } = opts;

  fastify.get('/api/analytics/dashboard', {
    schema: {
      description: 'Get comprehensive analytics dashboard',
      tags: ['analytics'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: { 
            type: 'string', 
            enum: ['1h', '24h', '7d', '30d', 'all'],
            default: '24h'
          },
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            overview: {
              type: 'object',
              properties: {
                totalQuotes: { type: 'number' },
                totalLikes: { type: 'number' },
                totalUsers: { type: 'number' },
                averageLikesPerQuote: { type: 'number' },
                quotesAddedToday: { type: 'number' }
              }
            },
            trending: {
              type: 'object',
              properties: {
                mostLikedQuotes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      content: { type: 'string' },
                      author: { type: 'string' },
                      likes: { type: 'number' },
                      trendingScore: { type: 'number' }
                    }
                  }
                },
                popularAuthors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      author: { type: 'string' },
                      quoteCount: { type: 'number' },
                      totalLikes: { type: 'number' },
                      averageLikes: { type: 'number' }
                    }
                  }
                }
              }
            },
            engagement: {
              type: 'object',
              properties: {
                likesOverTime: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'string' },
                      count: { type: 'number' }
                    }
                  }
                },
                topTags: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tag: { type: 'string' },
                      count: { type: 'number' },
                      averageLikes: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { timeRange = '24h', userId } = request.query as { timeRange?: string; userId?: string };
      const analytics = await quoteService.getAnalyticsDashboard(timeRange, userId);
      return analytics;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch analytics dashboard' });
    }
  });

  fastify.get('/api/recommendations/smart', {
    schema: {
      description: 'Get smart quote recommendations based on user behavior',
      tags: ['recommendations'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 20, default: 5 },
          algorithm: { 
            type: 'string', 
            enum: ['collaborative', 'content-based', 'hybrid', 'trending'],
            default: 'hybrid'
          },
          includeExplanation: { type: 'boolean', default: true }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  quote: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      content: { type: 'string' },
                      author: { type: 'string' },
                      tags: { type: 'array', items: { type: 'string' } },
                      likes: { type: 'number' },
                      likedByCurrentUser: { type: 'boolean' }
                    }
                  },
                  score: { type: 'number' },
                  reason: { type: 'string' },
                  confidence: { type: 'number' }
                }
              }
            },
            algorithm: { type: 'string' },
            totalProcessed: { type: 'number' },
            processingTime: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId, limit = 5, algorithm = 'hybrid', includeExplanation = true } = request.query as {
        userId: string;
        limit?: number;
        algorithm?: string;
        includeExplanation?: boolean;
      };
      
      const startTime = Date.now();
      const recommendations = await quoteService.getSmartRecommendations(
        userId, 
        limit, 
        algorithm, 
        includeExplanation
      );
      const processingTime = Date.now() - startTime;
      
      return {
        ...recommendations,
        algorithm,
        totalProcessed: recommendations.recommendations.length,
        processingTime
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to generate recommendations' });
    }
  });

  fastify.post('/api/quotes/compare', {
    schema: {
      description: 'Compare multiple quotes and analyze similarities/differences',
      tags: ['quotes'],
      body: {
        type: 'object',
        properties: {
          quoteIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 5
          },
          analysisType: {
            type: 'string',
            enum: ['comprehensive', 'quick', 'detailed'],
            default: 'comprehensive'
          },
          includeMetrics: { type: 'boolean', default: true }
        },
        required: ['quoteIds']
      }
    }
  }, async (request, reply) => {
    try {
      const { quoteIds, analysisType = 'comprehensive', includeMetrics = true } = request.body as {
        quoteIds: string[];
        analysisType?: string;
        includeMetrics?: boolean;
      };
      
      const comparison = await quoteService.compareQuotes(quoteIds, analysisType, includeMetrics);
      return comparison;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to compare quotes' });
    }
  });

  fastify.get('/api/insights/patterns', {
    schema: {
      description: 'Discover patterns and insights in quote data',
      tags: ['insights'],
      querystring: {
        type: 'object',
        properties: {
          patternType: {
            type: 'string',
            enum: ['sentiment', 'length', 'author', 'tags', 'engagement'],
            default: 'engagement'
          },
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d', 'all'],
            default: '7d'
          },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { patternType = 'engagement', timeRange = '7d', userId } = request.query as {
        patternType?: string;
        timeRange?: string;
        userId?: string;
      };
      
      const insights = await quoteService.discoverPatterns(patternType, timeRange, userId);
      return insights;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to discover patterns' });
    }
  });

  fastify.get('/api/feed/live', {
    schema: {
      description: 'Get real-time quote feed with live updates',
      tags: ['feed'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
          feedType: {
            type: 'string',
            enum: ['trending', 'personalized', 'recent', 'popular'],
            default: 'personalized'
          },
          includeActivity: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId, limit = 10, feedType = 'personalized', includeActivity = true } = request.query as {
        userId?: string;
        limit?: number;
        feedType?: string;
        includeActivity?: boolean;
      };
      
      const feed = await quoteService.getLiveFeed(userId, limit, feedType, includeActivity);
      return feed;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch live feed' });
    }
  });
};

export default analyticsRoutes;