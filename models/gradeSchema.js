const mongoose= require("mongoose");

const gradeSchema= new mongoose.Schema({
    event:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    round:{
        type: Number,
        required: true,
        default: 1
    },
    users: [{
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        grade: {
            type: Number
        },
        isDisqualified: {
            type: Boolean,
            default: false
        }
    }],
    teams:[{
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team'
        },
        grade: {
            type: Number
        },
        isDisqualified: {
            type: Boolean,
            default: false
        }
    }],
    criteria:{
        topParticipants: {
            type: Number
        },
        minGrade: {
            type: Number
        }
    }
});

module.exports= mongoose.model('Grade', gradeSchema);