const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authenticateToken.js');
const catchAsync= require("../utils/catchAsync.js");

router.route('/:id/get-all')
    .get(catchAsync(userController.getAllUsers));

router.route('/update-profile')
    .put(authenticateToken, catchAsync(userController.updateProfile));

router.route('/get-requests')
    .get(authenticateToken, catchAsync(userController.getRequests));
    
module.exports = router;