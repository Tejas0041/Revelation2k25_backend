const express= require('express');
const router= express.Router();
const requestController= require('../controllers/requestController.js');
const {authenticateToken}= require('../middleware/authenticateToken.js');
const catchAsync= require("../utils/catchAsync.js");

router.get('/pending/:id', catchAsync(requestController.getPendingRequests));

router.delete('/delete/:id', authenticateToken, catchAsync(requestController.deleteRequest));

module.exports= router;