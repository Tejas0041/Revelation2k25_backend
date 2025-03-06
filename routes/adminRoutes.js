const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Auth routes
router.get('/login', adminController.loginPage);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// Dashboard
router.get('/dashboard', adminAuth, adminController.dashboard);

// Events routes - Order matters!
router.get('/events', adminAuth, adminController.getAllEventsPage);
router.get('/event/new', adminAuth, adminController.createEventPage);
router.post('/event/new', adminAuth, upload.single('poster'), adminController.createEvent);
router.get('/event/:id', adminAuth, adminController.getEventByIdPage);
router.get('/event/edit/:id', adminAuth, adminController.getEditEventPage);
router.post('/event/edit/:id', adminAuth, upload.single('poster'), adminController.updateEvent);
router.get('/event/participants/:id', adminAuth, adminController.getEventParticipantsPage);

// Rest of routes
router.get('/users', adminAuth, adminController.getAllUsersPage);
router.get('/users/:id', adminAuth, adminController.getUserByIdPage);
router.get('/teams', adminAuth, adminController.getAllTeamsPage);
router.get('/teams/:id', adminAuth, adminController.getTeamByIdPage);
router.get('/registrations', adminAuth, adminController.getAllRegistrationsPage);

module.exports = router;
