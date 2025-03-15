const User = require("../models/userSchema.js");  
const Request = require("../models/requestSchema.js");
const Team = require("../models/teamSchema.js");
const Event = require("../models/eventSchema.js");

module.exports.getAllUsers = async (req, res) => {
    try {
        const {eventId}= req.body;
        const isIIESTian= req.user.isIIESTian;

        const users = await User.find({ 
            type: 'normal', 
            isIIESTian: isIIESTian,
            'eventsRegistered.id': { $ne: eventId }
        });


        return res.json({ message: "Successfully fetched all users", body: users });
    } catch (error) {
        res.status(500).json({ message: "Error getting users", error: error.message });
    }
}

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, phoneNumber } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Name cannot be empty"
            });
        }

        if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format. Must be 10 digits"
            });
        }

        const updateData = {
            name: name.trim()
        };

        if (phoneNumber) {
            updateData.phoneNumber = phoneNumber;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { 
                new: true,
                runValidators: true,
                select: '-password'
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
module.exports.getRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        const requests = await Request.find({$or: [{sender: userId}, {receiver: userId}]}).populate('sender receiver event team');

        const yourRequests = requests.filter(request => request.sender.equals(userId));
        const requestsForYou = requests.filter(request => request.receiver.equals(userId));

        return res.json({
            success: true,
            message: "Successfully fetched requests",
            yourRequests,
            requestsForYou
        });

    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({
            success: false,
            message: "Error getting requests"
        });
    }
}