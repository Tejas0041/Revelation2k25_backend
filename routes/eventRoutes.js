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
    .post(authenticateToken, upload.single('paymentProof'), eventController.registerEvent);

router.route('/:id/participants')
    .get(eventController.getEventParticipants);

router.route('/:eventId/registration-status')
    .get(authenticateToken, eventController.getRegistrationStatus);

router.route('/:id/make-request')
    .post(authenticateToken, eventController.makeRequest);

router.route('/reply-request')
    .post(authenticateToken, eventController.replyRequest);

module.exports = router;