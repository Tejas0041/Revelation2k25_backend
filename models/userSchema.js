const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: function () {
            return this.type !== 'admin';
        }
    },
    phoneNumber: {
        type: String
    },
    type: {
        type: String,
        enum: ['normal', 'admin'],
        default: 'normal',
        required: true
    },
    isIIESTian: {
        type: Boolean,
        required: function () {
            return this.type !== 'admin';
        }
    },
    picture: {
        type: String,
        required: function () {
            return this.type !== 'admin';
        }
    },
    eventsRegistered: [
        {
            id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: function () {
                    return this.type !== 'admin';
                }
            },
            team: {
                type: Boolean,
                required: function () {
                    return this.type !== 'admin';
                }
            },
            teamId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
                required: function () {
                    return this.team;
                }
            }
        }
    ],
    
    password: {
        type: String,
        required: function () {
            return this.type === 'admin';
        }
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);