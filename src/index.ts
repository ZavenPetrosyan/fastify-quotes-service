import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mercurius from 'mercurius';
import '@fastify/websocket';
import { renderPlaygroundPage } from 'graphql-playground-html';

import quotesRoutes from './application/rest/routes/quotes';
import analyticsRoutes from './application/rest/routes/analytics';
import requestIdPlugin from './application/middleware/requestId';
import { AdvancedQuoteServiceImpl } from './application/services/AdvancedQuoteServiceImpl';
import { InMemoryQuoteRepository } from './infrastructure/persistence/InMemoryQuoteRepository';
import { QuotableService } from './infrastructure/external/QuotableService';
import { typeDefs } from './application/graphql/schema';
import { resolvers } from './application/graphql/resolvers';
import { PubSub } from 'graphql-subscriptions';
import config from './config/environment';
import { APP_CONSTANTS } from './application/constants';
import { INFRASTRUCTURE_CONSTANTS } from './infrastructure/constants';

async function createApp() {
  const fastify = Fastify({
    logger: config.NODE_ENV === 'development' ? {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: config.LOG_LEVEL,
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
      },
    },
  });

  await fastify.register(cors, {
    origin: true,
    methods: INFRASTRUCTURE_CONSTANTS.SECURITY.CORS_METHODS,
  });

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_TIME_WINDOW,
  });

  await fastify.register(requestIdPlugin);

  await fastify.register(require('@fastify/websocket'));

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: APP_CONSTANTS.SWAGGER.TITLE,
        description: APP_CONSTANTS.SWAGGER.DESCRIPTION,
        version: APP_CONSTANTS.SWAGGER.VERSION,
      },
      host: `localhost:${config.PORT}`,
      schemes: APP_CONSTANTS.SWAGGER.SCHEMES,
      consumes: APP_CONSTANTS.SWAGGER.CONSUMES,
      produces: APP_CONSTANTS.SWAGGER.PRODUCES,
      tags: [...APP_CONSTANTS.SWAGGER.TAGS],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: APP_CONSTANTS.ENDPOINTS.DOCS,
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
    path: APP_CONSTANTS.GRAPHQL.PATH,
    routes: APP_CONSTANTS.GRAPHQL.ROUTES,
    ide: APP_CONSTANTS.GRAPHQL.IDE,
    allowBatchedQueries: APP_CONSTANTS.GRAPHQL.BATCHED_QUERIES,
    subscription: APP_CONSTANTS.GRAPHQL.SUBSCRIPTION,
  });

  fastify.get('/playground', async (request, reply) => {
    const playground = renderPlaygroundPage({
      endpoint: '/graphql',
      subscriptionEndpoint: '/graphql',
      settings: {
        'request.credentials': 'include',
      },
    });
    reply.type('text/html').send(playground);
  });

  await fastify.register(quotesRoutes, { quoteService });
  await fastify.register(analyticsRoutes, { quoteService });

  return fastify;
}

async function start() {
  try {
    const app = await createApp();
    
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server listening on http://${config.HOST}:${config.PORT}`);
    app.log.info(
      `Swagger documentation available at http://${config.HOST}:${config.PORT}${APP_CONSTANTS.ENDPOINTS.DOCS}`
    );
    app.log.info(
      `GraphiQL available at http://${config.HOST}:${config.PORT}${APP_CONSTANTS.GRAPHQL.PATH}`
    );
    app.log.info(
      `GraphQL Playground available at http://${config.HOST}:${config.PORT}/playground`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}

export { createApp };