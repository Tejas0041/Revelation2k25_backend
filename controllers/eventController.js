const Event = require('../models/eventSchema.js');
const Team = require('../models/teamSchema.js');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const User = require('../models/userSchema');
const EventRegistration = require('../models/eventRegistrationSchema');

module.exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.find();
        return res.json({ message: "Successfully fetched all events", body: events });
    } catch (error) {
        res.status(500).json({ message: "Error getting events", error: error.message });
    }
}


module.exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ message: "Event not found" });

        return res.json({ message: "Successfully fetched event", body: event });
    } catch (error) {
        res.status(500).json({ message: "Error getting event", error: error.message });
    }
}

const registerForEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { teamId } = req.body;
        const userId = req.user._id;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Check if user is already registered
        const existingRegistration = await EventRegistration.findOne({
            event: eventId,
            userId,
        });

        if (existingRegistration) {
            return res.status(400).json({ message: "Already registered for this event" });
        }

        let registrationData = {
            event: eventId,
            userId,
            registrationType: 'individual',
            registeredAt: new Date()
        };

        // If team registration
        if (teamId) {
            const team = await Team.findById(teamId);
            if (!team) {
                return res.status(404).json({ message: "Team not found" });
            }

            registrationData = {
                ...registrationData,
                registrationType: 'team',
                teamId
            };
        }

        // Create event registration
        const registration = new EventRegistration(registrationData);
        await registration.save();

        // Update user's eventsRegistered array
        await User.findByIdAndUpdate(userId, {
            $push: {
                eventsRegistered: {
                    id: eventId,
                    team: !!teamId,
                    teamId: teamId || null
                }
            }
        });

        res.status(201).json({ 
            message: "Successfully registered for event",
            registration 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: "Error registering for event" });
    }
};

// When creating a team
const createTeam = async (req, res) => {
    try {
        const { name, eventId, members } = req.body;
        const teamLeader = req.user._id;

        // Create team
        const team = new Team({
            name,
            teamLeader,
            teamMembers: members,
            eventId
        });
        await team.save();

        // Register event for team leader
        await User.findByIdAndUpdate(teamLeader, {
            $push: {
                eventsRegistered: {
                    id: eventId,
                    team: true,
                    teamId: team._id
                }
            }
        });

        // Register event for team members
        await User.updateMany(
            { _id: { $in: members } },
            {
                $push: {
                    eventsRegistered: {
                        id: eventId,
                        team: true,
                        teamId: team._id
                    }
                }
            }
        );

        // Create event registration for the team
        const registration = new EventRegistration({
            event: eventId,
            userId: teamLeader,
            registrationType: 'team',
            teamId: team._id,
            registeredAt: new Date()
        });
        await registration.save();

        res.status(201).json({
            message: "Team created successfully",
            team,
            registration
        });
    } catch (error) {
        console.error('Team creation error:', error);
        res.status(500).json({ message: "Error creating team" });
    }
};

module.exports.registerEvent = async (req, res) => {
    try {
        const { id: eventId } = req.params;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        let teamData = null;
        let participantData = null;

        // Parse JSON strings if they exist
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

        // Handle payment proof upload
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

        if (teamData && teamData.team) {
            // Create team registration
            const team = new Team({
                name: teamData.name,
                teamLeader: teamData.teamLeader,
                leaderPhone: teamData.leaderPhone,
                teamMembers: teamData.teamMembers,
                teamSize: teamData.teamMembers.length + 1
            });
            const savedTeam = await team.save();

            // Create team event registration
            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'team',
                teamId: savedTeam._id,
                paymentProof,
                userId: teamData.teamLeader
            });
            await registration.save();

            // Update team leader's eventsRegistered
            await User.findByIdAndUpdate(teamData.teamLeader, {
                $push: {
                    eventsRegistered: {
                        id: eventId,
                        team: true,
                        teamId: savedTeam._id
                    }
                }
            });

            // Update team members' eventsRegistered
            await User.updateMany(
                { _id: { $in: teamData.teamMembers } },
                {
                    $push: {
                        eventsRegistered: {
                            id: eventId,
                            team: true,
                            teamId: savedTeam._id
                        }
                    }
                }
            );

        } else if (participantData) {
            // Create individual registration
            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'individual',
                userId: participantData.userId,
                paymentProof
            });
            await registration.save();

            // Update user's eventsRegistered for individual registration
            await User.findByIdAndUpdate(participantData.userId, {
                $push: {
                    eventsRegistered: {
                        id: eventId,
                        team: false,
                        teamId: null // Explicitly set to null for individual registrations
                    }
                }
            });

            // Update phone number if provided
            if (participantData.phoneNumber) {
                await User.findByIdAndUpdate(participantData.userId, {
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
            teams: registrations.filter(reg => reg.registrationType === 'team')
                .map(reg => ({
                    ...reg.teamId.toObject(),
                    registrationId: reg._id,
                    registeredAt: reg.registeredAt,
                    paymentProof: reg.paymentProof,
                    status: reg.status
                })),
            individuals: registrations.filter(reg => reg.registrationType === 'individual')
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

exports.getRegistrationStatus = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user._id;

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // Check for individual registration
        const individualReg = await EventRegistration.findOne({
            event: eventId,
            userId: userId,
            registrationType: 'individual'
        }).populate('event');

        // Check for team registration - either as leader or member
        const teamReg = await EventRegistration.findOne({
            event: eventId,
            registrationType: 'team',
            $or: [
                { 'teamId.teamLeader': userId },
                { 'teamId.teamMembers': userId }
            ]
        }).populate('teamId event');

        if (!individualReg && !teamReg) {
            return res.json({
                success: true,
                body: {
                    isRegistered: false,
                    registrationType: null,
                    registration: null
                }
            });
        }

        // Format response based on registration type
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
                        paymentStatus: individualReg.paymentStatus || 'PENDING',
                        paymentProof: individualReg.paymentProof || null,
                        createdAt: individualReg.createdAt,
                        updatedAt: individualReg.updatedAt
                    }
                }
            });
        }

        // Team registration response
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
            message: "Error checking registration status"
        });
    }
};