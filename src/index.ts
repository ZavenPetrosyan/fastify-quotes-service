import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mercurius from 'mercurius';

import quotesRoutes from './application/rest/routes/quotes';
import requestIdPlugin from './application/middleware/requestId';
import { QuoteServiceImpl } from './application/services/QuoteServiceImpl';
import { InMemoryQuoteRepository } from './infrastructure/persistence/InMemoryQuoteRepository';
import { QuotableService } from './infrastructure/external/QuotableService';
import { typeDefs } from './application/graphql/schema';
import { resolvers } from './application/graphql/resolvers';

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
  const quoteService = new QuoteServiceImpl(quoteRepository, externalQuoteService);

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
    }),
    graphiql: {
      enabled: true,
    },
    path: '/graphql',
    routes: true,
    ide: true,
    allowBatchedQueries: true,
  });

  await fastify.register(quotesRoutes, { quoteService });

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