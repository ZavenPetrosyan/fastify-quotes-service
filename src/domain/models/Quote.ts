import { z } from 'zod';

export const QuoteSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  length: z.number().positive().optional(),
  dateAdded: z.string().optional(),
  dateModified: z.string().optional(),
});

export const ExternalQuoteSchema = z.object({
  _id: z.string(),
  content: z.string(),
  author: z.string(),
  tags: z.array(z.string()).optional().default([]),
  length: z.number().optional(),
  dateAdded: z.string().optional(),
  dateModified: z.string().optional(),
});

export const QuotableApiResponseSchema = z.object({
  _id: z.string(),
  content: z.string(),
  author: z.string(),
  tags: z.array(z.string()).optional().default([]),
  length: z.number().optional(),
  dateAdded: z.string().optional(),
  dateModified: z.string().optional(),
});

export const DummyJsonQuoteSchema = z.object({
  id: z.number(),
  quote: z.string(),
  author: z.string(),
});

export const DummyJsonResponseSchema = z.object({
  quotes: z.array(DummyJsonQuoteSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

export const QuoteLikeSchema = z.object({
  quoteId: z.string(),
  userId: z.string(),
  timestamp: z.date(),
});

export const QuoteWithStatsSchema = QuoteSchema.extend({
  likes: z.number().default(0),
  likedByCurrentUser: z.boolean().default(false),
});

export const UserIdSchema = z.object({
  userId: z.string().min(1),
});

export const SimilarQuotesQuerySchema = z.object({
  limit: z.number().min(1).max(20).default(5),
});

export const QuoteIdParamSchema = z.object({
  id: z.string().min(1),
});

export type Quote = z.infer<typeof QuoteSchema>;
export type ExternalQuote = z.infer<typeof ExternalQuoteSchema>;
export type QuotableApiResponse = z.infer<typeof QuotableApiResponseSchema>;
export type DummyJsonQuote = z.infer<typeof DummyJsonQuoteSchema>;
export type DummyJsonResponse = z.infer<typeof DummyJsonResponseSchema>;
export type QuoteLike = z.infer<typeof QuoteLikeSchema>;
export type QuoteWithStats = z.infer<typeof QuoteWithStatsSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type SimilarQuotesQuery = z.infer<typeof SimilarQuotesQuerySchema>;
export type QuoteIdParam = z.infer<typeof QuoteIdParamSchema>;