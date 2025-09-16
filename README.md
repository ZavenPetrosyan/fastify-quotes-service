# Fastify Quotes Service

A production-quality TypeScript web service built with Fastify that serves random quotes with like functionality, similarity search, and prioritized recommendations.

## Features

- **Random Quotes**: Fetches quotes from external APIs (quotable.io with DummyJSON fallback)
- **Like System**: Idempotent like/unlike functionality per user
- **Smart Prioritization**: Prioritizes highly-rated quotes for new users
- **Similarity Search**: Returns similar quotes based on content, author, and tags
- **Dual API**: Both REST and GraphQL interfaces
- **Security**: CORS, Helmet, rate limiting, request ID tracking
- **Documentation**: OpenAPI/Swagger docs and GraphiQL
- **Testing**: Comprehensive unit and integration tests
- **Production Ready**: Docker support, structured logging with Pino

## Quick Start (In-Memory Mode)

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run in production mode
npm run build
npm start
```

The service will be available at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **GraphiQL**: http://localhost:3000/graphiql

### Docker

```bash
# Build and run with Docker
docker build -t quotes-service .
docker run -p 3000:3000 quotes-service

# Or use Docker Compose
docker-compose up
```

## API Endpoints

### REST API

```bash
# Health check
curl http://localhost:3000/healthz

# Get random quote
curl http://localhost:3000/api/quotes/random

# Get random quote for specific user (enables prioritization)
curl "http://localhost:3000/api/quotes/random?userId=user123"

# Get specific quote
curl http://localhost:3000/api/quotes/{id}

# Like a quote (idempotent)
curl -X POST http://localhost:3000/api/quotes/{id}/like \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Unlike a quote
curl -X DELETE http://localhost:3000/api/quotes/{id}/like \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Get similar quotes
curl "http://localhost:3000/api/quotes/{id}/similar?limit=5"

# Search quotes
curl "http://localhost:3000/api/quotes?q=life&limit=10"
```

### GraphQL API

```graphql
# Get random quote
query {
  randomQuote(userId: "user123") {
    id
    content
    author
    tags
    likes
    likedByCurrentUser
  }
}

# Like a quote
mutation {
  likeQuote(quoteId: "quote-id", userId: "user123") {
    success
  }
}

# Get similar quotes
query {
  similarQuotes(id: "quote-id", limit: 5, userId: "user123") {
    id
    content
    author
    likes
    likedByCurrentUser
  }
}

# Search quotes
query {
  searchQuotes(query: "life", limit: 10, userId: "user123") {
    id
    content
    author
    tags
    likes
    likedByCurrentUser
  }
}
```

## Architecture

The project follows clean architecture principles with clear separation of concerns:

```
src/
├── domain/                 # Core business logic
│   ├── models/            # Data models with Zod validation
│   ├── services/          # Business service interfaces
│   └── repositories/      # Data access interfaces
├── application/           # Application layer
│   ├── services/          # Business logic implementation
│   ├── rest/             # REST API routes
│   ├── graphql/          # GraphQL schema and resolvers
│   └── middleware/       # Request middleware
├── infrastructure/       # External integrations
│   ├── external/         # External API clients
│   └── persistence/      # Data storage implementations
└── tests/               # Test suites
    ├── unit/            # Unit tests
    └── integration/     # Integration tests
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Development with hot reload
npm run dev
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (default: info)

## AI Assistance and Manual Implementation

This project was developed with AI assistance for rapid prototyping and code generation, with the following breakdown:

### AI-Generated Components
- **Project Structure**: Initial setup, package.json, and TypeScript configuration
- **Domain Models**: Zod schemas and TypeScript interfaces
- **Service Implementations**: Core business logic and algorithms
- **API Layer**: REST endpoints and GraphQL schema/resolvers
- **Infrastructure**: External API integration and in-memory repository
- **Testing**: Comprehensive test suites covering key functionality
- **Documentation**: This README and inline code documentation

### Manually Implemented/Reviewed
- **Architecture Decisions**: Clean architecture pattern and dependency injection
- **Security Configuration**: Helmet, CORS, and rate limiting settings
- **Similarity Algorithm**: Text-based similarity calculation logic
- **Error Handling**: Comprehensive error handling and validation
- **Performance Optimizations**: Quote prioritization and caching strategies
- **Testing Strategy**: Test coverage and integration test scenarios
- **Production Readiness**: Docker configuration and deployment considerations

### Key Manual Verification Points
- Type safety enforcement (strict TypeScript with no `any`)
- Input/output validation with Zod schemas
- Idempotency of like operations
- Proper error handling and status codes
- Security middleware configuration
- Test coverage for core functionality

The AI assistance significantly accelerated development time while maintaining code quality through proper architecture patterns and comprehensive testing. All generated code was reviewed for correctness, security, and maintainability.

## License

MIT