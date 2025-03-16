const mongoose= require('mongoose');

const imageSchema= mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    filename:{
        type: String,
        required: true
    }
});

const eventSchema= mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    type:{
        type: String,
        enum: ["Single", "Combined", "Team"],
        required: true     
    },
    teamSize:{
        type: Object,
        max: Number,
        min: Number,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    rules:{
        type: String
    },
    startTime:{
        type: Date,
        required: true
    },
    endTime:{
        type: Date,
        required: true
    },
    venue:{
        type: String,
        required: true        
    },
    registrationAmount:{
        type: Number,
        required: true
    },
    prizePool:{
        type: Number,
        required: true
    },
    posterImage: imageSchema,
    backgroundImage: imageSchema,
    eventGif: imageSchema  // Add new field for GIF
});

module.exports= mongoose.model('Event', eventSchema);