import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id'] as string || randomUUID();
    request.headers['x-request-id'] = requestId;
    reply.header('x-request-id', requestId);
    
    fastify.log.info({ requestId, method: request.method, url: request.url }, 'Request started');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const requestId = request.headers['x-request-id'];
    const responseTime = reply.getResponseTime();
    
    fastify.log.info({ 
      requestId, 
      method: request.method, 
      url: request.url, 
      statusCode: reply.statusCode,
      responseTime: `${responseTime}ms`
    }, 'Request completed');
  });
};

export default requestIdPlugin;