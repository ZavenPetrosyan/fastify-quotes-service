export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      },
    }),

    randomQuote: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getRandomQuote(args.userId);
    },

    quote: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getQuoteById(args.id, args.userId);
    },

    quotes: async (_parent: any, args: any, context: any) => {
      const { filter, sort, limit = 10, offset = 0, userId } = args;
      return context.quoteService.getQuotesWithFilter(filter, sort, limit, offset, userId);
    },

    similarQuotes: async (_parent: any, args: any, context: any) => {
      const limit = args.limit || 5;
      return context.quoteService.getSimilarQuotes(args.id, limit, args.userId);
    },

    searchQuotes: async (_parent: any, args: any, context: any) => {
      const limit = args.limit || 10;
      return context.quoteService.searchQuotes(args.query, limit, args.userId);
    },

    analytics: async (_parent: any, _args: any, context: any) => {
      return context.quoteService.getAnalytics();
    },

    trendingQuotes: async (_parent: any, args: any, context: any) => {
      const { limit = 10, timeRange = '24h' } = args;
      return context.quoteService.getTrendingQuotes(limit, timeRange);
    },

    popularAuthors: async (_parent: any, args: any, context: any) => {
      const limit = args.limit || 10;
      return context.quoteService.getPopularAuthors(limit);
    },

    collections: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getUserCollections(args.userId);
    },

    collection: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getCollection(args.id, args.userId);
    },

    userPreferences: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getUserPreferences(args.userId);
    },

    compareQuotes: async (_parent: any, args: any, context: any) => {
      return context.quoteService.compareQuotes(args.quoteIds);
    },

    recommendQuotes: async (_parent: any, args: any, context: any) => {
      const { userId, limit = 5 } = args;
      return context.quoteService.recommendQuotes(userId, limit);
    },

    quoteHistory: async (_parent: any, args: any, context: any) => {
      const { userId, limit = 20 } = args;
      return context.quoteService.getQuoteHistory(userId, limit);
    },
  },

  Mutation: {
    likeQuote: async (_parent: any, args: any, context: any) => {
      try {
        await context.quoteService.likeQuote(args.quoteId, args.userId);
        const quote = await context.quoteService.getQuoteById(args.quoteId, args.userId);
        return { 
          success: true, 
          newLikeCount: quote?.likes || 0 
        };
      } catch (error) {
        throw new Error(`Failed to like quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    unlikeQuote: async (_parent: any, args: any, context: any) => {
      try {
        await context.quoteService.unlikeQuote(args.quoteId, args.userId);
        const quote = await context.quoteService.getQuoteById(args.quoteId, args.userId);
        return { 
          success: true, 
          newLikeCount: quote?.likes || 0 
        };
      } catch (error) {
        throw new Error(`Failed to unlike quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createCollection: async (_parent: any, args: any, context: any) => {
      try {
        const collection = await context.quoteService.createCollection(
          args.name,
          args.description,
          args.isPublic,
          args.userId
        );
        return { success: true, collection };
      } catch (error) {
        throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    addQuoteToCollection: async (_parent: any, args: any, context: any) => {
      try {
        const collection = await context.quoteService.addQuoteToCollection(
          args.collectionId,
          args.quoteId,
          args.userId
        );
        return { success: true, collection };
      } catch (error) {
        throw new Error(
          `Failed to add quote to collection: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    removeQuoteFromCollection: async (_parent: any, args: any, context: any) => {
      try {
        const collection = await context.quoteService.removeQuoteFromCollection(
          args.collectionId,
          args.quoteId,
          args.userId
        );
        return { success: true, collection };
      } catch (error) {
        throw new Error(
          `Failed to remove quote from collection: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    deleteCollection: async (_parent: any, args: any, context: any) => {
      try {
        await context.quoteService.deleteCollection(args.collectionId, args.userId);
        return { success: true, collection: null };
      } catch (error) {
        throw new Error(`Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    updateUserPreferences: async (_parent: any, args: any, context: any) => {
      try {
        return await context.quoteService.updateUserPreferences(
          args.userId,
          args.favoriteAuthors,
          args.favoriteTags
        );
      } catch (error) {
        throw new Error(
          `Failed to update user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    shareQuote: async (_parent: any, args: any, context: any) => {
      try {
        return await context.quoteService.shareQuote(args.quoteId, args.userId);
      } catch (error) {
        throw new Error(`Failed to share quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    reportQuote: async (_parent: any, args: any, context: any) => {
      try {
        return await context.quoteService.reportQuote(args.quoteId, args.reason, args.userId);
      } catch (error) {
        throw new Error(`Failed to report quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },

  Subscription: {
    quoteLiked: {
      subscribe: async (_parent: any, args: any, context: any) => {
        return context.pubsub.asyncIterator(`QUOTE_LIKED_${args.quoteId}`);
      },
    },
    newQuoteAdded: {
      subscribe: async (_parent: any, _args: any, context: any) => {
        return context.pubsub.asyncIterator('NEW_QUOTE_ADDED');
      },
    },
    trendingQuotesUpdated: {
      subscribe: async (_parent: any, _args: any, context: any) => {
        return context.pubsub.asyncIterator('TRENDING_QUOTES_UPDATED');
      },
    },
    userActivity: {
      subscribe: async (_parent: any, args: any, context: any) => {
        return context.pubsub.asyncIterator(`USER_ACTIVITY_${args.userId}`);
      },
    },
  },

  Quote: {
    similarQuotes: async (parent: any, args: any, context: any) => {
      const limit = args.limit || 3;
      return context.quoteService.getSimilarQuotes(parent.id, limit);
    },
  },
};