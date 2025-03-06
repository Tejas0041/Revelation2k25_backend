const User = require("../models/userSchema.js");  

module.exports.getAllUsers = async (req, res) => {
    try {
        const currentUser= req.user;
        const users = await User.find({ type: 'normal' });
        return res.json({ message: "Successfully fetched all users", body: users });
    } catch (error) {
        res.status(500).json({ message: "Error getting users", error: error.message });
    }
}