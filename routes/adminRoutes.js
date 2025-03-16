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
    { name: 'backgroundImage', maxCount: 1 }
]), catchAsync(adminController.createEvent));
router.get('/event/:id', adminAuth, catchAsync(adminController.getEventByIdPage));
router.get('/event/edit/:id', adminAuth, catchAsync(adminController.getEditEventPage));
router.post('/event/edit/:id', adminAuth, upload.single('poster'), catchAsync(adminController.updateEvent));
router.get('/event/participants/:id', adminAuth, catchAsync(adminController.getEventParticipantsPage));

// Rest of routes
router.get('/users', adminAuth, catchAsync(adminController.getAllUsersPage));
router.get('/users/:id', adminAuth, catchAsync(adminController.getUserByIdPage));
router.get('/teams', adminAuth, catchAsync(adminController.getAllTeamsPage));
router.get('/teams/:id', adminAuth, catchAsync(adminController.getTeamByIdPage));
router.get('/registrations', adminAuth, catchAsync(adminController.getAllRegistrationsPage));

module.exports = router;
