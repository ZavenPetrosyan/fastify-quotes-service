# Fastify Quotes Service

A TypeScript web service built with Fastify that serves random quotes with like functionality and similarity search.

## Features

- **Random Quotes**: Fetches quotes from external APIs (quotable.io with DummyJSON fallback)
- **Like System**: Like/unlike quotes per user
- **Similarity Search**: Find similar quotes based on content and author
- **Dual API**: Both REST and GraphQL interfaces
- **Analytics**: Basic analytics and trending quotes
- **Collections**: Create and manage quote collections

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or with Docker
docker-compose up
```

## Service URLs

Once running, access the following interfaces:

- **API Documentation**: http://localhost:3000/docs (Swagger UI)
- **GraphQL Playground**: http://localhost:3000/playground (Interactive GraphQL)
- **Health Check**: http://localhost:3000/healthz

## Development

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```
