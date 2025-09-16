export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),

    randomQuote: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getRandomQuote(args.userId);
    },

    quote: async (_parent: any, args: any, context: any) => {
      return context.quoteService.getQuoteById(args.id, args.userId);
    },

    similarQuotes: async (_parent: any, args: any, context: any) => {
      const limit = args.limit || 5;
      return context.quoteService.getSimilarQuotes(args.id, limit, args.userId);
    },

    searchQuotes: async (_parent: any, args: any, context: any) => {
      const limit = args.limit || 10;
      return context.quoteService.searchQuotes(args.query, limit, args.userId);
    },
  },

  Mutation: {
    likeQuote: async (_parent: any, args: any, context: any) => {
      try {
        await context.quoteService.likeQuote(args.quoteId, args.userId);
        return { success: true };
      } catch (error) {
        throw new Error(`Failed to like quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    unlikeQuote: async (_parent: any, args: any, context: any) => {
      try {
        await context.quoteService.unlikeQuote(args.quoteId, args.userId);
        return { success: true };
      } catch (error) {
        throw new Error(`Failed to unlike quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
};