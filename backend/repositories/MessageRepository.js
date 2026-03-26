const Message = require('../models/Message');

class MessageRepository {
    async create(messageData) {
        const message = new Message(messageData);
        return await message.save();
    }

    async findByGroup(groupId, limit = 50) {
        return await Message.find({ groupId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('senderId', 'name email');
    }
}

module.exports = new MessageRepository();
