const express= require('express');
const router= express.Router();
const requestController= require('../controllers/requestController.js');
const {authenticateToken}= require('../middleware/authenticateToken.js');
const catchAsync= require("../utils/catchAsync.js");

router.get('/pending/:id', catchAsync(requestController.getPendingRequests));

router.get('/pending-via-user/:eventId', authenticateToken, catchAsync(requestController.getPendingRequestsForUser))

router.delete('/delete/:id', authenticateToken, catchAsync(requestController.deleteRequest));

module.exports= router;