import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mercurius from 'mercurius';
import '@fastify/websocket';

import quotesRoutes from './application/rest/routes/quotes';
import analyticsRoutes from './application/rest/routes/analytics';
import requestIdPlugin from './application/middleware/requestId';
import { AdvancedQuoteServiceImpl } from './application/services/AdvancedQuoteServiceImpl';
import { InMemoryQuoteRepository } from './infrastructure/persistence/InMemoryQuoteRepository';
import { QuotableService } from './infrastructure/external/QuotableService';
import { typeDefs } from './application/graphql/schema';
import { resolvers } from './application/graphql/resolvers';
import { PubSub } from 'graphql-subscriptions';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function createApp() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development' ? {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  const quoteRepository = new InMemoryQuoteRepository();
  const externalQuoteService = new QuotableService();
  const pubsub = new PubSub();
  const quoteService = new AdvancedQuoteServiceImpl(quoteRepository, externalQuoteService, pubsub);

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(requestIdPlugin);

  // Register WebSocket support for GraphQL subscriptions
  await fastify.register(require('@fastify/websocket'));

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Fastify Quotes Service',
        description: 'A TypeScript web service built with Fastify for serving random quotes',
        version: '1.0.0',
      },
      host: `localhost:${PORT}`,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'quotes', description: 'Quote management endpoints' },
        { name: 'analytics', description: 'Advanced analytics and insights' },
        { name: 'recommendations', description: 'Smart recommendation engine' },
        { name: 'insights', description: 'Pattern discovery and insights' },
        { name: 'feed', description: 'Real-time quote feeds' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  await fastify.register(mercurius, {
    schema: typeDefs,
    resolvers,
    context: () => ({
      quoteService,
      pubsub,
    }),
    graphiql: {
      enabled: true,
    },
    path: '/graphql',
    routes: true,
    ide: true,
    allowBatchedQueries: true,
    subscription: true,
  });

  await fastify.register(quotesRoutes, { quoteService });
  await fastify.register(analyticsRoutes, { quoteService });

  return fastify;
}

async function start() {
  try {
    const app = await createApp();
    
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
    app.log.info(`Swagger documentation available at http://${HOST}:${PORT}/docs`);
    app.log.info(`GraphiQL available at http://${HOST}:${PORT}/graphiql`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}

export { createApp };