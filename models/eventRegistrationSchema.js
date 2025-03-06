const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.registrationType === 'individual';
        }
    },
    registrationType: {
        type: String,
        enum: ['individual', 'team'],
        required: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: function() {
            return this.registrationType === 'team';
        }
    },
    paymentProof: {
        url: String,
        filename: String
    },
    registeredAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for quick lookups
eventRegistrationSchema.index({ event: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
