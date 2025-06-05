const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const catchAsync= require("../utils/catchAsync.js");


// Auth routes
router.get('/login', adminController.loginPage);
router.post('/login', catchAsync(adminController.login));
router.get('/logout', adminController.logout);

// Dashboard
router.get('/dashboard', adminAuth, catchAsync(adminController.dashboard));

// Events routes
router.get('/events', adminAuth, catchAsync(adminController.getAllEventsPage));
router.get('/event/new', adminAuth, catchAsync(adminController.createEventPage));
router.post('/event/new', adminAuth, upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'backgroundImage', maxCount: 1 },
    { name: 'eventGif', maxCount: 1 }
]), catchAsync(adminController.createEvent));
router.get('/event/:id', adminAuth, catchAsync(adminController.getEventByIdPage));
router.get('/event/edit/:id', adminAuth, catchAsync(adminController.getEditEventPage));
router.post('/event/edit/:id', adminAuth, upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'backgroundImage', maxCount: 1 },
    { name: 'eventGif', maxCount: 1 }
]), catchAsync(adminController.updateEvent));
router.get('/event/participants/:id', adminAuth, catchAsync(adminController.getEventParticipantsPage));
router.get(`/event/toggle-islive/:id`, adminAuth, catchAsync(adminController.toggleIsLive))

// Rest of routes
router.get('/users', adminAuth, catchAsync(adminController.getAllUsersPage));
router.get('/users/:id', adminAuth, catchAsync(adminController.getUserByIdPage));
router.get('/teams', adminAuth, catchAsync(adminController.getAllTeamsPage));
router.get('/teams/:id', adminAuth, catchAsync(adminController.getTeamByIdPage));
router.get('/registrations', adminAuth, catchAsync(adminController.getAllRegistrationsPage));

router.get('/grade-participants', adminAuth, catchAsync(adminController.gradeParticipantsPage));
router.get('/grade-participants/:id/:round', adminAuth, catchAsync(adminController.gradeParticipantsOfEventPage))
router.get('/grade-participants/:eventId/:round/toggle-qualify/:participantId', adminAuth, catchAsync(adminController.toggleQualifyParticipant))
router.post('/grade-participants/:eventId/:round/submit-points', adminController.submitPoints);
router.get('/grade-participants/:eventId/:round/edit', adminController.editRoundDetailsPage);

// router.get('/get-event-sheet/:id', adminController.createAndShareEventSheet);

// router.get('/delete-registration/:id', adminAuth, catchAsync(adminController.deleteEventRegistration))
// router.post('/create-admin', adminController.createAdmin);

module.exports = router;
