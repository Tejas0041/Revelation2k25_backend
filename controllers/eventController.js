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

        // Debug log
        console.log('Received data:', {
            teamData,
            participantData,
            body: req.body
        });

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

        const registrationType = teamData ? 'team' : 'individual';

        if (registrationType === 'team') {
            if (!teamData || !teamData.name || !teamData.teamLeader || !teamData.teamMembers) {
                return res.status(400).json({ 
                    message: "Missing required team data",
                    receivedData: teamData
                });
            }

            // Create team
            const team = new Team({
                name: teamData.name,
                teamLeader: teamData.teamLeader,
                leaderPhone: teamData.leaderPhone,
                teamMembers: teamData.teamMembers,
                teamSize: teamData.teamMembers.length + 1
            });
            const savedTeam = await team.save();

            // Create event registration for team
            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'team',
                teamId: savedTeam._id,
                paymentProof,
                status: 'pending'
            });
            await registration.save();

        } else {
            if (!participantData || !participantData.userId) {
                return res.status(400).json({ 
                    message: "Missing required participant data",
                    receivedData: participantData 
                });
            }

            // Create event registration for individual
            const registration = new EventRegistration({
                event: eventId,
                registrationType: 'individual',
                userId: participantData.userId,
                paymentProof,
                status: 'pending'
            });
            await registration.save();

            // Update user phone number if provided
            if (participantData.phoneNumber) {
                await User.findByIdAndUpdate(participantData.userId, {
                    phoneNumber: participantData.phoneNumber
                });
            }
        }

        return res.json({ 
            message: "Successfully registered for event"
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: "Error registering for event", 
            error: error.message,
            stack: error.stack
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