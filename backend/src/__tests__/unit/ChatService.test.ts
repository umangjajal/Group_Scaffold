import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const Plans = require('../../../models/Plan');
const MessageRepository = require('../../../repositories/MessageRepository');
const QuotaRepository = require('../../../repositories/QuotaRepository');
const ChatService = require('../../../services/ChatService');

describe('ChatService', () => {
  let findMessageQuota: ReturnType<typeof vi.fn>;
  let incrementMessageCount: ReturnType<typeof vi.fn>;
  let findPlan: ReturnType<typeof vi.fn>;
  let createMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    findMessageQuota = vi.fn();
    incrementMessageCount = vi.fn().mockResolvedValue({ count: 51 });
    findPlan = vi.fn();
    createMessage = vi.fn();

    QuotaRepository.findMessageQuota = findMessageQuota;
    QuotaRepository.incrementMessageCount = incrementMessageCount;
    Plans.findOne = findPlan;
    MessageRepository.create = createMessage;
  });

  describe('sendMessage', () => {
    it('should throw an error if the daily message limit is reached', async () => {
      const userId = 'user123';
      const groupId = 'group123';
      const content = 'Hello';
      const userPlan = 'free';

      findMessageQuota.mockResolvedValue({ count: 100 });
      findPlan.mockResolvedValue({ dailyMessageLimit: 100 });

      await expect(ChatService.sendMessage(userId, groupId, content, userPlan)).rejects.toThrow(
        'Daily message limit reached',
      );
    });

    it('should create a message and increment the quota if the limit is not reached', async () => {
      const userId = 'user123';
      const groupId = 'group123';
      const content = 'Hello';
      const userPlan = 'free';

      findMessageQuota.mockResolvedValue({ count: 50 });
      findPlan.mockResolvedValue({ dailyMessageLimit: 100 });
      createMessage.mockResolvedValue({ id: 'msg123', content });

      const result = await ChatService.sendMessage(userId, groupId, content, userPlan);

      expect(result).toEqual({ id: 'msg123', content });
      expect(incrementMessageCount).toHaveBeenCalledWith(userId, expect.any(String));
    });
  });
});
