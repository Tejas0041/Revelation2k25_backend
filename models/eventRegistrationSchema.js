const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    registrationType: {
        type: String,
        enum: ['individual', 'team'],
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.registrationType === 'individual';
        }
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

// Pre-save middleware to ensure either userId or teamId is present
eventRegistrationSchema.pre('save', function(next) {
    if (this.registrationType === 'individual' && !this.userId) {
        next(new Error('userId is required for individual registration'));
    } else if (this.registrationType === 'team' && !this.teamId) {
        next(new Error('teamId is required for team registration'));
    } else {
        next();
    }
});

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
