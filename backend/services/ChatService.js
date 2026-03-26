const MessageRepository = require('../repositories/MessageRepository');
const QuotaRepository = require('../repositories/QuotaRepository');
const Plans = require('../models/Plan');

class ChatService {
    async sendMessage(userId, groupId, content, userPlan) {
        const dateKey = new Date().toISOString().slice(0, 10);
        
        // Check message quota
        const quota = await QuotaRepository.findMessageQuota(userId, dateKey);
        const plan = await Plans.findOne({ name: userPlan || 'Free' });
        const limit = plan ? plan.dailyMessageLimit : 100;

        if (quota && quota.count >= limit) {
            throw new Error('Daily message limit reached');
        }

        const message = await MessageRepository.create({
            senderId: userId,
            groupId,
            content
        });

        await QuotaRepository.incrementMessageCount(userId, dateKey);

        return message;
    }

    async getHistory(groupId) {
        return await MessageRepository.findByGroup(groupId);
    }
}

module.exports = new ChatService();
