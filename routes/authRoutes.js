const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware');

router.route('/google')
    .post(authController.googleAuth);

router.route('/status')
    .get(authenticateToken, authController.status);

router.route('/logout')
    .get(authController.logout);

module.exports = router;
