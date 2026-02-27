const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Group = require('../models/group');

async function fix() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
    console.log('Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    // Find all groups where roomCode is explicitly null
    const result = await Group.updateMany(
        { roomCode: null },
        { $unset: { roomCode: "" } }
    );

    console.log(`Updated ${result.modifiedCount} groups. Removed explicit null from roomCode.`);
    
    // Also check for duplicates just in case
    const groups = await Group.find({});
    console.log(`Total groups: ${groups.length}`);

    await mongoose.disconnect();
    console.log('Disconnected.');
}

fix().catch(err => {
    console.error(err);
    process.exit(1);
});
