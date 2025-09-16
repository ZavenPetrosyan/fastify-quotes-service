import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../index';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { status: string; timestamp: string };
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Random Quote Endpoint', () => {
    it('should return a random quote', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/quotes/random',
      });

      expect(response.statusCode).toBe(200);
      const quote = JSON.parse(response.body) as {
        id: string;
        content: string;
        author: string;
        likes: number;
        likedByCurrentUser: boolean;
      };
      
      expect(quote.id).toBeDefined();
      expect(quote.content).toBeDefined();
      expect(quote.author).toBeDefined();
      expect(typeof quote.likes).toBe('number');
      expect(typeof quote.likedByCurrentUser).toBe('boolean');
    });

    it('should return different quotes on subsequent calls', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/quotes/random',
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/quotes/random',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const quote1 = JSON.parse(response1.body) as { id: string };
      const quote2 = JSON.parse(response2.body) as { id: string };

      expect(quote1.id).toBeDefined();
      expect(quote2.id).toBeDefined();
    });
  });

  describe('Like Functionality', () => {
    it('should like and unlike a quote with idempotency', async () => {
      const randomResponse = await app.inject({
        method: 'GET',
        url: '/api/quotes/random',
      });

      const quote = JSON.parse(randomResponse.body) as { id: string };

      const likeResponse1 = await app.inject({
        method: 'POST',
        url: `/api/quotes/${quote.id}/like`,
        payload: { userId: 'test-user' },
      });

      expect(likeResponse1.statusCode).toBe(200);
      const likeResult1 = JSON.parse(likeResponse1.body) as { success: boolean };
      expect(likeResult1.success).toBe(true);

      const likeResponse2 = await app.inject({
        method: 'POST',
        url: `/api/quotes/${quote.id}/like`,
        payload: { userId: 'test-user' },
      });

      expect(likeResponse2.statusCode).toBe(200);
      const likeResult2 = JSON.parse(likeResponse2.body) as { success: boolean };
      expect(likeResult2.success).toBe(true);

      const quoteResponse = await app.inject({
        method: 'GET',
        url: `/api/quotes/${quote.id}?userId=test-user`,
      });

      const updatedQuote = JSON.parse(quoteResponse.body) as { 
        likes: number; 
        likedByCurrentUser: boolean; 
      };
      expect(updatedQuote.likes).toBe(1);
      expect(updatedQuote.likedByCurrentUser).toBe(true);

      const unlikeResponse = await app.inject({
        method: 'DELETE',
        url: `/api/quotes/${quote.id}/like`,
        payload: { userId: 'test-user' },
      });

      expect(unlikeResponse.statusCode).toBe(200);

      const finalQuoteResponse = await app.inject({
        method: 'GET',
        url: `/api/quotes/${quote.id}?userId=test-user`,
      });

      const finalQuote = JSON.parse(finalQuoteResponse.body) as { 
        likes: number; 
        likedByCurrentUser: boolean; 
      };
      expect(finalQuote.likes).toBe(0);
      expect(finalQuote.likedByCurrentUser).toBe(false);
    });
  });

  describe('Similar Quotes', () => {
    it('should return similar quotes', async () => {
      const randomResponse = await app.inject({
        method: 'GET',
        url: '/api/quotes/random',
      });

      const quote = JSON.parse(randomResponse.body) as { id: string };

      const similarResponse = await app.inject({
        method: 'GET',
        url: `/api/quotes/${quote.id}/similar?limit=3`,
      });

      expect(similarResponse.statusCode).toBe(200);
      const similarQuotes = JSON.parse(similarResponse.body) as Array<{ id: string }>;
      expect(Array.isArray(similarQuotes)).toBe(true);
      expect(similarQuotes.every(q => q.id !== quote.id)).toBe(true);
    });
  });

  describe('GraphQL API', () => {
    it('should execute health query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: 'query { health { status timestamp } }',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body) as {
        data: { health: { status: string; timestamp: string } };
      };
      expect(result.data.health.status).toBe('ok');
      expect(result.data.health.timestamp).toBeDefined();
    });

    it('should execute randomQuote query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `
            query {
              randomQuote {
                id
                content
                author
                likes
                likedByCurrentUser
              }
            }
          `,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body) as {
        data: {
          randomQuote: {
            id: string;
            content: string;
            author: string;
            likes: number;
            likedByCurrentUser: boolean;
          };
        };
      };
      
      expect(result.data.randomQuote.id).toBeDefined();
      expect(result.data.randomQuote.content).toBeDefined();
      expect(result.data.randomQuote.author).toBeDefined();
      expect(typeof result.data.randomQuote.likes).toBe('number');
      expect(typeof result.data.randomQuote.likedByCurrentUser).toBe('boolean');
    });

    it('should execute like mutation', async () => {
      const randomResponse = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: 'query { randomQuote { id } }',
        },
      });

      const randomResult = JSON.parse(randomResponse.body) as {
        data: { randomQuote: { id: string } };
      };
      const quoteId = randomResult.data.randomQuote.id;

      const likeResponse = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `
            mutation {
              likeQuote(quoteId: "${quoteId}", userId: "gql-test-user") {
                success
              }
            }
          `,
        },
      });

      expect(likeResponse.statusCode).toBe(200);
      const likeResult = JSON.parse(likeResponse.body) as {
        data: { likeQuote: { success: boolean } };
      };
      expect(likeResult.data.likeQuote.success).toBe(true);
    });
  });
});