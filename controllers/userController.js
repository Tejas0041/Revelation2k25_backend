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

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, phoneNumber } = req.body;

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Name cannot be empty"
            });
        }

        // Phone number validation (optional)
        if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format. Must be 10 digits"
            });
        }

        // Update only allowed fields
        const updateData = {
            name: name.trim()
        };

        // Only add phone number if provided
        if (phoneNumber) {
            updateData.phoneNumber = phoneNumber;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { 
                new: true,
                runValidators: true,
                select: '-password' // Exclude password from response
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: "Error updating profile"
        });
    }
};