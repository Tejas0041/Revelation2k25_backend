const express = require('express');
const router = express.Router();
const eventController= require('../controllers/eventController.js');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const {authenticateToken}= require('../middleware/authenticateToken.js');
const catchAsync= require("../utils/catchAsync.js");

router.route('/get-all')
    .get(catchAsync(eventController.getAllEvents));

router.route('/:id')
    .get(catchAsync(eventController.getEventById));

router.route('/:id/register')
    .post(authenticateToken, upload.single('paymentProof'), catchAsync(eventController.registerEvent));

router.route('/:id/participants')
    .get(catchAsync(eventController.getEventParticipants));

router.route('/:eventId/registration-status')
    .get(authenticateToken, catchAsync(eventController.getRegistrationStatus));

router.route('/:id/make-request')
    .post(authenticateToken, catchAsync(eventController.makeRequest));

router.route('/reply-request')
    .post(authenticateToken, catchAsync(eventController.replyRequest));

module.exports = router;