const Event = require('../models/eventSchema.js');
const Team = require('../models/teamSchema.js');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const User = require('../models/userSchema.js');
const EventRegistration = require('../models/eventRegistrationSchema.js');
const Request = require('../models/requestSchema.js');
const mongoose= require('mongoose');
const jwt = require("jsonwebtoken");

module.exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.find().lean();

        const eventsWithDay = events.map(event => {
            const startTimeDate = new Date(event.startTime);
            const dateString = startTimeDate.toISOString().split('T')[0];
            
            let day = 1;
            switch(dateString) {
                case '2025-03-22':
                    day = 2;
                    break;
                case '2025-03-23':
                    day = 3;
                    break;
                default:
                    day = 1;
            }
            
            return {
                ...event,
                day
            };
        });
            
        return res.json({ 
            message: "Successfully fetched all events", 
            body: eventsWithDay 
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error getting events", 
            error: error.message 
        });
    }
}

module.exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        let event = await Event.findById(id).populate('posterImage').lean()
        const startTimeDate = new Date(event.startTime);
        const dateString = startTimeDate.toISOString().split('T')[0];
        
        let day = 1;
        switch(dateString) {
            case '2025-03-22':
                day = 2;
                break;
            case '2025-03-23':
                day = 3;
                break;
            default:
                day = 1;
        }
        
        if (!event) return res.status(404).json({ message: "Event not found" });
        event= {...event, day};
        return res.json({ message: "Successfully fetched event", body:  event});
    } catch (error) {
        res.status(500).json({ message: "Error getting event", error: error.message });
    }
}

module.exports.registerEvent = async (req, res) => {
    try {
        const { id: eventId } = req.params;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        let teamData = null;
        let participantData = null;

        try {
            if (req.body.teamData) {
                teamData = typeof req.body.teamData === 'string' 
                    ? JSON.parse(req.body.teamData) 
                    : req.body.teamData;
            }
            if (req.body.participantData) {
                participantData = typeof req.body.participantData === 'string' 
                    ? JSON.parse(req.body.participantData) 
                    : req.body.participantData;
            }
        } catch (e) {
            return res.status(400).json({ 
                message: "Invalid data format", 
                error: e.message 
            });
        }

        let paymentProof = null;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                let cld_upload_stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'revelation2k25/payments',
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
            });
            
            paymentProof = {
                url: result.secure_url,
                filename: result.public_id
            };
        }

        if((event.registrationAmount!==0) && (!req.user.isIIESTian) && !paymentProof){
            return res.status(400).json({ 
                message: "Payment proof is required" 
            });
        }

        if (teamData) {
            const team = new Team({
                name: teamData.name,
                teamLeader: req.user._id,
                leaderPhone: teamData.phoneNumber,
                teamSize: 1
            });

            const savedTeam = await team.save();

            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'team',
                teamId: savedTeam._id,
                paymentProof,
                userId: req.user._id
            });
            await registration.save();

            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    eventsRegistered: {
                        id: eventId,
                        team: true,
                        teamId: savedTeam._id,
                    }
                }
            });

        } else if (participantData) {
            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'individual',
                userId: req.user._id,
                paymentProof
            });
            await registration.save();

            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    eventsRegistered: {
                        id: eventId,
                        team: false,
                        teamId: null,
                    }
                }
            });

            if (participantData.phoneNumber) {
                await User.findByIdAndUpdate(req.user._id, {
                    phoneNumber: participantData.phoneNumber
                });
            }
        } else {
            return res.status(400).json({ 
                message: "Invalid registration data"
            });
        }

        return res.json({ 
            message: "Successfully registered for event"
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: "Error registering for event", 
            error: error.message
        });
    }
};
module.exports.getEventParticipants = async (req, res) => {
    try {
        const { id: eventId } = req.params;

        let currentUser = null;
        const token = req.headers.authorization?.split(" ")[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUser = await User.findById(decoded.id)
                    .populate('eventsRegistered.id eventsRegistered.teamId');
            } catch (err) {
                console.log('Token verification failed:', err.message);
            }
        }

        const registrations = await EventRegistration.find({ event: eventId })
            .populate('event')
            .populate({
                path: 'teamId',
                populate: {
                    path: 'teamLeader teamMembers',
                    select: 'name email picture isIIESTian'
                }
            })
            .populate('userId', 'name email picture isIIESTian');

        const participants = {
            teams: {
                others: registrations
                    .filter(reg => reg.registrationType === 'team')
                    .filter(reg => {
                        if (!currentUser) return true;
                        const userEvent = currentUser.eventsRegistered.find(
                            event => event.id && event.id.equals(eventId)
                        );
                        return !(userEvent && userEvent.team && userEvent.teamId && 
                               userEvent.teamId._id.equals(reg.teamId._id));
                    })
                    .map(reg => ({
                        ...reg.teamId.toObject(),
                        registrationId: reg._id,
                        registeredAt: reg.registeredAt,
                        paymentProof: reg.paymentProof,
                        status: reg.status
                    })),
                you: currentUser ? registrations
                    .filter(reg => 
                        reg.registrationType === 'team' && 
                        currentUser.eventsRegistered.some(event => 
                            event.id && 
                            event.id.equals(eventId) && 
                            event.team && 
                            event.teamId && 
                            event.teamId._id.equals(reg.teamId._id)
                        )
                    ) : []
            },
            individuals: registrations
                .filter(reg => reg.registrationType === 'individual')
                .map(reg => ({
                    ...reg.userId.toObject(),
                    registrationId: reg._id,
                    registeredAt: reg.registeredAt,
                    paymentProof: reg.paymentProof,
                    status: reg.status
                }))
        };

        return res.json({ 
            message: "Successfully fetched participants",
            body: participants
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            message: "Error fetching participants", 
            error: error.message 
        });
    }
};
module.exports.getRegistrationStatus = async (req, res) => {
    try {
        const { id } = req.params;  // Changed from eventId to id to match route param
        // const userId = req.user._id;
        console.log(req.user);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // Update the query to use proper conditions
        const individualReg = await EventRegistration.findOne({
            event: id,
            user: userId,  // Changed from userId to user to match schema
            registrationType: 'individual'
        }).populate('event');

        // Update team registration query
        const teamReg = await EventRegistration.findOne({
            event: id,
            registrationType: 'team',
            $or: [
                { teamLeader: userId },  // Changed the path to match your schema
                { teamMembers: userId }
            ]
        }).populate('team event');  // Make sure to populate both team and event

        // Return early if no registration found
        if (!individualReg && !teamReg) {
            return res.json({
                success: true,
                body: null
            });
        }

        if (individualReg) {
            return res.json({
                success: true,
                body: {
                    isRegistered: true,
                    registrationType: 'INDIVIDUAL',
                    registration: {
                        _id: individualReg._id,
                        userId: individualReg.userId,
                        eventId: individualReg.event._id,
                        // paymentStatus: individualReg.paymentStatus || 'PENDING',
                        paymentProof: individualReg.paymentProof || null,
                        createdAt: individualReg.createdAt,
                        updatedAt: individualReg.updatedAt
                    }
                }
            });
        }

        return res.json({
            success: true,
            body: {
                isRegistered: true,
                registrationType: 'TEAM',
                registration: {
                    _id: teamReg.teamId._id,
                    name: teamReg.teamId.name,
                    eventId: teamReg.event._id,
                    teamLeader: teamReg.teamId.teamLeader,
                    teamMembers: teamReg.teamId.teamMembers,
                    teamSize: teamReg.teamId.teamSize,
                    leaderPhone: teamReg.teamId.leaderPhone,
                    paymentProof: teamReg.paymentProof || null,
                    createdAt: teamReg.createdAt,
                    updatedAt: teamReg.updatedAt
                }
            }
        });

    } catch (error) {
        console.error('Error checking registration status:', error);
        res.status(500).json({
            success: false,
            message: "Error checking registration status",
            error: error.message
        });
    }
};

module.exports.makeRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { teamId, userId } = req.body;

        if (!teamId || !userId) {
            return res.status(400).json({
                message: "Invalid request data"
            });
        }

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const user= await User.findById(userId);
        if(!user){
            return res.status(404).json({
                message: "User not found"
            });
        }

        const event= await Event.findById(id);

        if(!event){
            return res.status(404).json({
                message: "Event not found"
            });
        }

        if (team.teamMembers.length >= event.teamSize.max) {
            return res.status(400).json({
                message: "Team is full"
            });
        }

        if (team.teamMembers.includes(req.user._id)) {
            return res.status(400).json({
                message: "You are already a member of this team"
            });
        }

        const newRequest= new Request({
            sender: req.user._id,
            receiver: userId,
            team: teamId,
            event: id,
            status: 'pending'
        });

        await newRequest.save();

        return res.json({
            message: "Successfully made a request",
            body: newRequest
        });
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            message: "Error making request",
            error: error.message
        });
    }
}

module.exports.replyRequest= async (req, res) => { 
    try {
        let { requestId, isAccepted } = req.body;
        console.log(requestId);

        if (!requestId || (isAccepted==undefined)) {
            return res.status(400).json({
                message: "Invalid request data"
            });
        }

        const request= await Request.findOne({_id: requestId})
        // console.log(request);

        if (!request) {
            return res.status(404).json({
                message: "Request not found"
            });
        }

        if (isAccepted) {
            const team= await Team.findById(request.team);
            await Team.findByIdAndUpdate(request.team, {
                $push: {
                    teamMembers: team.teamLeader.equals(request.receiver)?request.sender:request.receiver 
                }
            });
            await User.findByIdAndUpdate(team.teamLeader.equals(request.receiver)?request.sender:request.receiver, {
                $push: {
                    eventsRegistered: {
                        id: request.event,
                        team: true,
                        teamId: request.team,
                    }
                }
            });
        } else {
            request.status= 'rejected';
        }

        await request.save();

        return res.json({
            message: "Successfully replied to request",
            body: request
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            message: "Error replying to request",
            error: error.message
        });
    }
}