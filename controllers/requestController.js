const Request= require("../models/requestSchema.js");

module.exports.getPendingRequests= async (req, res)=> {
    try {
        const { id }= req.params;
        const requests= await Request.find({
            team: id,
            status: 'pending'
        });

        return res.json({ message: "Successfully fetched all pending requests", body: requests });
    } catch (error) {
        res.status(500).json({ message: "Error getting pending requests", error: error.message });
    }
}

module.exports.deleteRequest= async (req, res)=> {
    try {
        const { id }= req.params;
        const request= await Request.findById(id);

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (!request.sender.equals(req.user._id)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await Request.findByIdAndDelete(id);

        res.status(200).json({ message: "Request deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting request", error: error.message
        });
    }
}