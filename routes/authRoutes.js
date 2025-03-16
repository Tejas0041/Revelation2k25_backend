const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authenticateToken');
const catchAsync= require("../utils/catchAsync.js");

router.route('/google')
    .post(catchAsync(authController.googleAuth));

router.route('/status')
    .get(authenticateToken, catchAsync(authController.status));

module.exports = router;