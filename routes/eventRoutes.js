const express = require('express');
const router = express.Router();
const eventController= require('../controllers/eventController.js');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const {authenticateToken}= require('../middleware/authenticateToken.js');

router.route('/get-all')
    .get(eventController.getAllEvents);

router.route('/:id')
    .get(eventController.getEventById);

router.route('/:id/register')
    .post(upload.single('paymentProof'), eventController.registerEvent);

router.route('/:id/participants')
    .get(eventController.getEventParticipants);

router.get('/:eventId/registration-status', authenticateToken, eventController.getRegistrationStatus);

module.exports = router;