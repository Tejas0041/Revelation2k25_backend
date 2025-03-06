const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    totalEvents: {
        type: Number,
        default: 0
    },
    usersCount: {
        total: { type: Number, default: 0 },
        iiestian: { type: Number, default: 0 },
        nonIiestian: { type: Number, default: 0 }
    },
    teamsCount: {
        total: { type: Number, default: 0 },
        iiestian: { type: Number, default: 0 },
        nonIiestian: { type: Number, default: 0 }
    },
    registrationsCount: {
        total: { type: Number, default: 0 },
        iiestian: { type: Number, default: 0 },
        nonIiestian: { type: Number, default: 0 },
        individual: { type: Number, default: 0 },
        team: { type: Number, default: 0 }
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Stats', statsSchema);
