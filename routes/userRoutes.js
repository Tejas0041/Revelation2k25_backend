const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authenticateToken.js');

router.route('/get-all')
    .get(authenticateToken, userController.getAllUsers);

router.put('/update-profile', authenticateToken, userController.updateProfile);

module.exports = router;