const mongoose = require('mongoose');

const GoogleSheetSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        unique: true, // Ensure one sheet per event
    },
    googleSheetId: {
        type: String,
        required: true,
    },
    googleSheetUrl: {
        type: String,
        required: true,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

const GoogleSheet = mongoose.model('GoogleSheet', GoogleSheetSchema);

module.exports = GoogleSheet;