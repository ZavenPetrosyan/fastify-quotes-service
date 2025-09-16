export const typeDefs = `
  type Quote {
    id: String!
    content: String!
    author: String!
    tags: [String!]!
    length: Int
    dateAdded: String
    dateModified: String
    likes: Int!
    likedByCurrentUser: Boolean!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
  }

  type LikeResult {
    success: Boolean!
  }

  type Query {
    health: HealthStatus!
    randomQuote(userId: String): Quote!
    quote(id: String!, userId: String): Quote
    similarQuotes(id: String!, limit: Int = 5, userId: String): [Quote!]!
    searchQuotes(query: String, limit: Int = 10, userId: String): [Quote!]!
  }

  type Mutation {
    likeQuote(quoteId: String!, userId: String!): LikeResult!
    unlikeQuote(quoteId: String!, userId: String!): LikeResult!
  }
`;