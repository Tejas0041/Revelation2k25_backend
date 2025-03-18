const Team = require("../models/teamSchema.js");
const User = require("../models/userSchema.js");
const EventRegistration = require("../models/eventRegistrationSchema.js");
const Request = require("../models/requestSchema.js");

module.exports.deleteTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const team = await Team.findById(id);

        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        if (!team.teamLeader.equals(req.user._id)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await EventRegistration.deleteMany({ teamId: team._id });

        const allTeamMembers = [team.teamLeader, ...team.teamMembers];
        await User.updateMany(
            { _id: { $in: allTeamMembers } },
            { 
                $pull: { 
                    eventsRegistered: { 
                        team: true, 
                        teamId: team._id 
                    } 
                } 
            }
        );

        await Request.deleteMany({ team: team._id });

        await Team.findByIdAndDelete(team._id);

        res.status(200).json({ message: "Team and all related records deleted successfully" });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ 
            message: "Error deleting team", 
            error: error.message 
        });
    }
};