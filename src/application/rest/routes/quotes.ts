import { FastifyPluginAsync } from 'fastify';
import { QuoteService } from '../../../domain/services/QuoteService';

interface QuotesRouteOptions {
  quoteService: QuoteService;
}

const quotesRoutes: FastifyPluginAsync<QuotesRouteOptions> = async (fastify, opts) => {
  const { quoteService } = opts;

  fastify.get('/healthz', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
    },
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/api/quotes/random', {
    schema: {
      description: 'Get a random quote',
      tags: ['quotes'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.query as { userId?: string };
      const quote = await quoteService.getRandomQuote(userId);
      return quote;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch random quote' });
    }
  });

  fastify.get('/api/quotes/:id', {
    schema: {
      description: 'Get a quote by ID',
      tags: ['quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.query as { userId?: string };
    
    const quote = await quoteService.getQuoteById(id, userId);
    if (!quote) {
      return reply.status(404).send({ error: 'Quote not found' });
    }
    
    return quote;
  });

  fastify.post('/api/quotes/:id/like', {
    schema: {
      description: 'Like a quote',
      tags: ['quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      
      await quoteService.likeQuote(id, userId);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Quote not found') {
        return reply.status(404).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(400).send({ error: 'Failed to like quote' });
    }
  });

  fastify.delete('/api/quotes/:id/like', {
    schema: {
      description: 'Unlike a quote',
      tags: ['quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };
    
    await quoteService.unlikeQuote(id, userId);
    return { success: true };
  });

  fastify.get('/api/quotes/:id/similar', {
    schema: {
      description: 'Get similar quotes',
      tags: ['quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 20, default: 5 },
          userId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: number; userId?: string };
    const limit = query.limit || 5;
    const { userId } = query;
    
    return quoteService.getSimilarQuotes(id, limit, userId);
  });

  fastify.get('/api/quotes', {
    schema: {
      description: 'Search quotes',
      tags: ['quotes'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
          userId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { q?: string; limit?: number; userId?: string };
    const { q, userId } = query;
    const limit = query.limit || 10;
    
    return quoteService.searchQuotes(q, limit, userId);
  });
};

export default quotesRoutes;