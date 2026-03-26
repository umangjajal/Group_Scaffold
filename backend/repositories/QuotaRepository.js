const QuotaUsage = require('../models/QuotaUsage');
const CallQuota = require('../models/CallQuota');

class QuotaRepository {
    async findMessageQuota(userId, dateKey) {
        return await QuotaUsage.findOne({ userId, date: dateKey });
    }

    async incrementMessageCount(userId, dateKey) {
        return await QuotaUsage.findOneAndUpdate(
            { userId, date: dateKey },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
        );
    }

    async findCallQuota(userId, dateKey) {
        return await CallQuota.findOne({ userId, date: dateKey });
    }

    async updateCallQuota(userId, dateKey, seconds) {
        return await CallQuota.findOneAndUpdate(
            { userId, date: dateKey },
            { $inc: { usedSeconds: seconds } },
            { upsert: true, new: true }
        );
    }
}

module.exports = new QuotaRepository();
