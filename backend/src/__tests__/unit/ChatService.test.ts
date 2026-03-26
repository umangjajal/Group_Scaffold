import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatService from '../../services/ChatService';
import MessageRepository from '../../repositories/MessageRepository';
import QuotaRepository from '../../repositories/QuotaRepository';
import Plans from '../../models/Plan';

vi.mock('../../repositories/MessageRepository');
vi.mock('../../repositories/QuotaRepository');
vi.mock('../../models/Plan');

describe('ChatService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendMessage', () => {
        it('should throw an error if the daily message limit is reached', async () => {
            const userId = 'user123';
            const groupId = 'group123';
            const content = 'Hello';
            const userPlan = 'free';

            (QuotaRepository.findMessageQuota as any).mockResolvedValue({ count: 100 });
            (Plans.findOne as any).mockResolvedValue({ dailyMessageLimit: 100 });

            await expect(ChatService.sendMessage(userId, groupId, content, userPlan))
                .rejects.toThrow('Daily message limit reached');
        });

        it('should create a message and increment the quota if the limit is not reached', async () => {
            const userId = 'user123';
            const groupId = 'group123';
            const content = 'Hello';
            const userPlan = 'free';

            (QuotaRepository.findMessageQuota as any).mockResolvedValue({ count: 50 });
            (Plans.findOne as any).mockResolvedValue({ dailyMessageLimit: 100 });
            (MessageRepository.create as any).mockResolvedValue({ id: 'msg123', content });

            const result = await ChatService.sendMessage(userId, groupId, content, userPlan);

            expect(result).toEqual({ id: 'msg123', content });
            expect(QuotaRepository.incrementMessageCount).toHaveBeenCalledWith(userId, expect.any(String));
        });
    });
});
