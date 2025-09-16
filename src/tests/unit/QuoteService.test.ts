import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuoteServiceImpl } from '../../application/services/QuoteServiceImpl';
import { InMemoryQuoteRepository } from '../../infrastructure/persistence/InMemoryQuoteRepository';
import { ExternalQuoteService } from '../../domain/services/ExternalQuoteService';
import { Quote } from '../../domain/models/Quote';

const mockExternalQuoteService: ExternalQuoteService = {
  fetchRandomQuote: vi.fn(),
};

describe('QuoteServiceImpl', () => {
  let quoteService: QuoteServiceImpl;
  let quoteRepository: InMemoryQuoteRepository;

  beforeEach(() => {
    quoteRepository = new InMemoryQuoteRepository();
    quoteService = new QuoteServiceImpl(quoteRepository, mockExternalQuoteService);
    vi.clearAllMocks();
  });

  describe('getRandomQuote', () => {
    it('should fetch from external service when no local quotes exist', async () => {
      const externalQuote: Quote = {
        id: '1',
        content: 'Test quote',
        author: 'Test Author',
        tags: ['test'],
      };

      vi.mocked(mockExternalQuoteService.fetchRandomQuote).mockResolvedValue(externalQuote);

      const result = await quoteService.getRandomQuote();

      expect(result).toEqual({
        ...externalQuote,
        likes: 0,
        likedByCurrentUser: false,
      });
      expect(mockExternalQuoteService.fetchRandomQuote).toHaveBeenCalledOnce();
    });

    it('should return local quote when available', async () => {
      const localQuote: Quote = {
        id: '2',
        content: 'Local quote',
        author: 'Local Author',
        tags: ['local'],
      };

      await quoteRepository.saveQuote(localQuote);

      const result = await quoteService.getRandomQuote();

      expect(result.id).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.author).toBeDefined();
      expect(result.likes).toBe(0);
      expect(result.likedByCurrentUser).toBe(false);
    });

    it('should include like information for authenticated user', async () => {
      const quote: Quote = {
        id: '3',
        content: 'Liked quote',
        author: 'Author',
        tags: [],
      };

      await quoteRepository.saveQuote(quote);
      await quoteRepository.addLike({
        quoteId: '3',
        userId: 'user1',
        timestamp: new Date(),
      });

      const result = await quoteService.getRandomQuote('user1');

      expect(result.likes).toBe(1);
      expect(result.likedByCurrentUser).toBe(true);
    });
  });

  describe('likeQuote', () => {
    it('should add like successfully', async () => {
      const quote: Quote = {
        id: '4',
        content: 'Quote to like',
        author: 'Author',
        tags: [],
      };

      await quoteRepository.saveQuote(quote);
      await quoteService.likeQuote('4', 'user1');

      const likes = await quoteRepository.getLikesByQuoteId('4');
      expect(likes).toHaveLength(1);
      expect(likes[0]?.userId).toBe('user1');
    });

    it('should be idempotent - not add duplicate likes', async () => {
      const quote: Quote = {
        id: '5',
        content: 'Quote to like twice',
        author: 'Author',
        tags: [],
      };

      await quoteRepository.saveQuote(quote);
      await quoteService.likeQuote('5', 'user1');
      await quoteService.likeQuote('5', 'user1');

      const likes = await quoteRepository.getLikesByQuoteId('5');
      expect(likes).toHaveLength(1);
    });

    it('should throw error for non-existent quote', async () => {
      await expect(quoteService.likeQuote('nonexistent', 'user1')).rejects.toThrow('Quote not found');
    });
  });

  describe('getSimilarQuotes', () => {
    it('should return similar quotes based on author', async () => {
      const quote1: Quote = {
        id: '6',
        content: 'First quote',
        author: 'Same Author',
        tags: [],
      };

      const quote2: Quote = {
        id: '7',
        content: 'Second quote',
        author: 'Same Author',
        tags: [],
      };

      const quote3: Quote = {
        id: '8',
        content: 'Third quote',
        author: 'Different Author',
        tags: [],
      };

      await quoteRepository.saveQuote(quote1);
      await quoteRepository.saveQuote(quote2);
      await quoteRepository.saveQuote(quote3);

      const similar = await quoteService.getSimilarQuotes('6', 5);

      expect(similar).toHaveLength(2);
      expect(similar.some(q => q.id === '7')).toBe(true);
      expect(similar.some(q => q.id === '8')).toBe(true);
      
      const sameAuthorQuote = similar.find(q => q.id === '7');
      const differentAuthorQuote = similar.find(q => q.id === '8');
      
      expect(sameAuthorQuote).toBeDefined();
      expect(differentAuthorQuote).toBeDefined();
    });

    it('should return empty array for non-existent quote', async () => {
      const similar = await quoteService.getSimilarQuotes('nonexistent', 5);
      expect(similar).toHaveLength(0);
    });
  });

  describe('searchQuotes', () => {
    it('should search quotes by content', async () => {
      const quote1: Quote = {
        id: '9',
        content: 'Life is beautiful',
        author: 'Author 1',
        tags: [],
      };

      const quote2: Quote = {
        id: '10',
        content: 'Love is everything',
        author: 'Author 2',
        tags: [],
      };

      await quoteRepository.saveQuote(quote1);
      await quoteRepository.saveQuote(quote2);

      const results = await quoteService.searchQuotes('life');

      expect(results).toHaveLength(1);
      expect(results[0]?.content).toBe('Life is beautiful');
    });

    it('should search quotes by author', async () => {
      const quote: Quote = {
        id: '11',
        content: 'Some quote',
        author: 'Einstein',
        tags: [],
      };

      await quoteRepository.saveQuote(quote);

      const results = await quoteService.searchQuotes('einstein');

      expect(results).toHaveLength(1);
      expect(results[0]?.author).toBe('Einstein');
    });

    it('should return all quotes when no query provided', async () => {
      const quote1: Quote = {
        id: '12',
        content: 'Quote 1',
        author: 'Author 1',
        tags: [],
      };

      const quote2: Quote = {
        id: '13',
        content: 'Quote 2',
        author: 'Author 2',
        tags: [],
      };

      await quoteRepository.saveQuote(quote1);
      await quoteRepository.saveQuote(quote2);

      const results = await quoteService.searchQuotes();

      expect(results).toHaveLength(2);
    });
  });
});