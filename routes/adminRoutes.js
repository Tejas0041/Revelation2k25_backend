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

// Events routes
router.get('/events', adminAuth, adminController.getAllEventsPage);
router.get('/events/new', adminAuth, adminController.createEventPage);
router.post('/events/new', adminAuth, upload.single('poster'), adminController.createEvent);
router.get('/events/:id', adminAuth, adminController.getEventByIdPage);
router.get('/events/:id/edit', adminAuth, adminController.getEditEventPage);
router.put('/events/:id', adminAuth, upload.single('poster'), adminController.updateEvent);
router.get('/events/:id/participants', adminAuth, adminController.getEventParticipantsPage);

// Users routes
router.get('/users', adminAuth, adminController.getAllUsersPage);
router.get('/users/:id', adminAuth, adminController.getUserByIdPage);

// Teams routes
router.get('/teams', adminAuth, adminController.getAllTeamsPage);
router.get('/teams/:id', adminAuth, adminController.getTeamById);

// Registrations routes
router.get('/registrations', adminAuth, adminController.getAllRegistrationsPage);

module.exports = router;
