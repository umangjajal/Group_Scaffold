const User = require('../models/User');

class UserRepository {
    async findById(id) {
        return await User.findById(id).select('-passwordHash');
    }

    async findByEmail(email) {
        return await User.findOne({ email });
    }

    async findByPhone(phone) {
        return await User.findOne({ phone });
    }

    async create(userData) {
        const user = new User(userData);
        return await user.save();
    }

    async update(id, updateData) {
        return await User.findByIdAndUpdate(id, updateData, { new: true });
    }
}

module.exports = new UserRepository();
