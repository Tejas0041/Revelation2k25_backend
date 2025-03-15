const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authenticateToken');

router.route('/google')
    .post(authController.googleAuth);

router.route('/status')
    .get(authenticateToken, authController.status);

module.exports = router;