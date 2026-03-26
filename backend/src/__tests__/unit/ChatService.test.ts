import { beforeEach, describe, expect, it, vi } from 'vitest';
import Plans from '../../models/Plan';
import MessageRepository from '../../repositories/MessageRepository';
import QuotaRepository from '../../repositories/QuotaRepository';
import ChatService from '../../services/ChatService';

vi.mock('../../repositories/MessageRepository');
vi.mock('../../repositories/QuotaRepository');
vi.mock('../../models/Plan');

describe('ChatService', () => {
  const mockedFindMessageQuota = vi.mocked(QuotaRepository.findMessageQuota);
  const mockedFindPlan = vi.mocked(Plans.findOne);
  const mockedCreateMessage = vi.mocked(MessageRepository.create);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should throw an error if the daily message limit is reached', async () => {
      const userId = 'user123';
      const groupId = 'group123';
      const content = 'Hello';
      const userPlan = 'free';

      mockedFindMessageQuota.mockResolvedValue({ count: 100 } as never);
      mockedFindPlan.mockResolvedValue({ dailyMessageLimit: 100 } as never);

      await expect(ChatService.sendMessage(userId, groupId, content, userPlan)).rejects.toThrow(
        'Daily message limit reached',
      );
    });

    it('should create a message and increment the quota if the limit is not reached', async () => {
      const userId = 'user123';
      const groupId = 'group123';
      const content = 'Hello';
      const userPlan = 'free';

      mockedFindMessageQuota.mockResolvedValue({ count: 50 } as never);
      mockedFindPlan.mockResolvedValue({ dailyMessageLimit: 100 } as never);
      mockedCreateMessage.mockResolvedValue({ id: 'msg123', content } as never);

      const result = await ChatService.sendMessage(userId, groupId, content, userPlan);

      expect(result).toEqual({ id: 'msg123', content });
      expect(QuotaRepository.incrementMessageCount).toHaveBeenCalledWith(
        userId,
        expect.any(String),
      );
    });
  });
});
