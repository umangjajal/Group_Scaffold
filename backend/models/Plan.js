// backend/models/Plan.js
module.exports = {
    free: {
        maxGroupsJoin: 10,
        maxGroupsCreate: 10,
        maxMembersPerGroup: 100,
        dailyMessages: 500,
        maxMediaMB: 10
    },
    premium: {
        maxGroupsJoin: 20,
        maxGroupsCreate: 5,
        maxMembersPerGroup: 200,
        dailyMessages: 2000,
        maxMediaMB: 25
    },
    vip: {
        maxGroupsJoin: 50,
        maxGroupsCreate: 15,
        maxMembersPerGroup: 1000,
        dailyMessages: 10000,
        maxMediaMB: 100
    },
    viip: {
        maxGroupsJoin: 200,
        maxGroupsCreate: 50,
        maxMembersPerGroup: 5000,
        dailyMessages: 100000,
        maxMediaMB: 250
    }
};