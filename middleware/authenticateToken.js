const jwt = require("jsonwebtoken");
const User= require("../models/userSchema.js");  

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Unauthorized" });
  
    jwt.verify(token, process.env.JWT_SECRET, async(err, user) => {
      if (err) return res.status(403).json({ message: "Forbidden" });
      req.user = await User.findById(user.id).populate('eventsRegistered.id eventsRegistered.teamId');
      next();
    });
};

module.exports= {authenticateToken};