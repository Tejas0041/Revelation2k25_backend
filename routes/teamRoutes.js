const express= require('express');
const router= express.Router();
const teamController= require('../controllers/teamController.js');
const {authenticateToken}= require('../middleware/authenticateToken.js');
const catchAsync= require("../utils/catchAsync.js");

router.delete('/delete/:id', authenticateToken, catchAsync(teamController.deleteTeam));

module.exports= router;