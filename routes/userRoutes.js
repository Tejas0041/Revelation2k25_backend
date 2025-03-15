const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authenticateToken.js');

router.route('/get-all')
    .get(authenticateToken, userController.getAllUsers);

router.route('/update-profile')
    .put(authenticateToken, userController.updateProfile);

router.route('/get-requests')
    .get(authenticateToken, userController.getRequests);
    
module.exports = router;