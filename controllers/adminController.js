const User = require('../models/userSchema');
const Event = require('../models/eventSchema');
const Team = require('../models/teamSchema');
const EventRegistration = require('../models/eventRegistrationSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const Grade= require("../models/gradeSchema.js");
const mongoose = require('mongoose');
const { google } = require('googleapis')

const serviceAccountKey = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
const GoogleSheet= require("../models/googleSheetSchema.js");

// const auth = new google.auth.OAuth2({
//     clientId: credentials.web.client_id,
//     clientSecret: credentials.web.client_secret,
//     redirectUri: credentials.web.redirect_uris[0], // Use the first redirect URI
// });
const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

// const authUrl = auth.generateAuthUrl({
//     access_type: 'offline', // Request a refresh token
//     scope: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
// });

// console.log('Authorize this app by visiting this URL:', authUrl);

// const getTokens = async (code) => {
//     const { tokens } = await auth.getToken(code);
//     auth.setCredentials(tokens);
//     return tokens;
// };

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });


module.exports.loginPage = (req, res) => {
    return res.render('admin/login', { 
        error: null,
        path: 'login'
    });
};

module.exports.login = async (req, res) => {
    const { name, password } = req.body;
    
    try {
        const admin = await User.findOne({ name, type: 'admin' });
        if (!admin || !(await admin.comparePassword(password))) {
            return res.render('admin/login', { 
                error: 'Invalid credentials',
                path: 'login'
            });
        }

        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.cookie('admin_token', token, { httpOnly: true });
        
        return res.json({ 
            success: true, 
            token,
            redirect: '/admin/dashboard'
        });
    } catch (error) {
        res.render('admin/login', { 
            error: 'Server error',
            path: 'login'
        });
    }
};

exports.dashboard = async (req, res) => {
    try {
        const [events, users, registrations] = await Promise.all([
            Event.find(),
            User.find({ type: 'normal' }),
            EventRegistration.find().populate('event userId teamId')
        ]);

        const eventTypes = {
            total: events.length,
            single: events.filter(e => e.type === 'Single').length,
            team: events.filter(e => e.type === 'Team').length,
            combined: events.filter(e => e.type === 'Combined').length
        };

        const userStats = {
            total: users.length,
            iiestian: users.filter(u => u.isIIESTian).length,
            nonIiestian: users.filter(u => !u.isIIESTian).length
        };

        const registrationStats = {
            total: registrations.length,
            individual: registrations.filter(r => r.registrationType === 'individual').length,
            team: registrations.filter(r => r.registrationType === 'team').length
        };

        const eventStats = events.map(event => {
            const eventRegistrations = registrations.filter(r => r.event?._id.toString() === event._id.toString());
            
            return {
                name: event.name,
                type: event.type,
                registrations: {
                    total: eventRegistrations.length,
                    individual: eventRegistrations.filter(r => r.registrationType === 'individual').length,
                    team: eventRegistrations.filter(r => r.registrationType === 'team').length,
                    iiestian: eventRegistrations.filter(r => 
                        (r.registrationType === 'individual' && r.userId?.isIIESTian) ||
                        (r.registrationType === 'team' && r.teamId?.teamLeader?.isIIESTian)
                    ).length,
                    nonIiestian: eventRegistrations.filter(r => 
                        (r.registrationType === 'individual' && !r.userId?.isIIESTian) ||
                        (r.registrationType === 'team' && !r.teamId?.teamLeader?.isIIESTian)
                    ).length
                }
            };
        }).sort((a, b) => b.registrations.total - a.registrations.total);

        res.render('admin/dashboard', {
            title: 'Dashboard',
            path: 'dashboard',
            stats: {
                eventTypes,
                users: userStats,
                registrations: registrationStats,
                eventStats
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', {
            message: 'Error loading dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

module.exports.logout = (req, res) => {
    res.clearCookie('admin_token');
    res.redirect('/admin/login');
};

module.exports.createAdmin = async (req, res) => {
    try {
        const { name, password } = req.body;
        
        const existingAdmin = await User.findOne({ name, type: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = new User({
            name,
            password: hashedPassword,
            type: 'admin',
        });

        await admin.save();
        res.json({ message: "Admin created successfully", admin });
    } catch (error) {
        res.status(500).json({ message: "Error creating admin", error: error.message });
    }
};


module.exports.createEventPage = (req, res) => {
    res.render('admin/events/new', { 
        title: 'Create Event',
        path: '/events',
        error: null,
        formData: {
            name: '',
            type: 'Single',
            teamSize: { min: '1', max: '1' },
            description: '',
            rules: '',
            startTime: '',
            endTime: '',
            venue: '',
            registrationAmount: ''
        }
    });
};

module.exports.createEvent = async (req, res) => {
    try {
        const { 
            name, 
            type, 
            teamSize, 
            description, 
            rules, 
            startTime, 
            endTime, 
            venue, 
            registrationAmount,
            registrationFrom,
            registrationLink,
            prizePool  // Make sure prizePool is destructured from req.body
        } = req.body;

        const needsSizeLimits = type === 'Team' || type === 'Combined';
        const sizeLimits = needsSizeLimits ? {
            min: parseInt(teamSize.min) || 1,
            max: parseInt(teamSize.max) || 1
        } : { min: 1, max: 1 };

        // Check if required files are present
        if (!req.files || !req.files.poster || !req.files.backgroundImage) {
            return res.render('admin/events/new', { 
                error: 'Both poster and background image are required',
                formData: req.body,
                title: 'Create Event',
                path: '/events'
            });
        }

        const uploadImage = async (file) => {
            return new Promise((resolve, reject) => {
                let cld_upload_stream = cloudinary.uploader.upload_stream(
                    { folder: 'revelation2k25/events' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(file.buffer).pipe(cld_upload_stream);
            });
        };

        // Upload all images in parallel
        const [posterResult, backgroundResult, gifResult] = await Promise.all([
            uploadImage(req.files.poster[0]),
            uploadImage(req.files.backgroundImage[0]),
            req.files.eventGif ? uploadImage(req.files.eventGif[0]) : null
        ]);

        // Create event data
        const eventData = {
            name,
            type,
            teamSize: sizeLimits,
            description,
            rules: Array.isArray(rules) ? rules.filter(rule => rule.trim()) : [rules],
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            venue,
            registrationAmount: parseInt(registrationAmount),
            prizePool: parseInt(prizePool), // Add prizePool to eventData
            posterImage: {
                url: posterResult.secure_url,
                filename: posterResult.public_id
            },
            backgroundImage: {
                url: backgroundResult.secure_url,
                filename: backgroundResult.public_id
            },
            registrationFrom,
            registrationLink: registrationFrom === 'external' ? registrationLink : null,
            isRegistrationOpen: true
        };

        // Add GIF if uploaded
        if (gifResult) {
            eventData.eventGif = {
                url: gifResult.secure_url,
                filename: gifResult.public_id
            };
        }

        const event = new Event(eventData);
        await event.save();
        
        return res.redirect('/admin/events');
    } catch (error) {
        console.error('Error creating event:', error);
        return res.render('admin/events/new', { 
            error: error.message || 'Error creating event',
            formData: req.body,
            title: 'Create Event',
            path: '/events'
        });
    }
};


module.exports.getEditEventPage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        res.render('admin/events/edit', { event, error: null });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('Error fetching event');
    }
};

module.exports.updateEvent = async (req, res) => {
    try {
        const { 
            name, type, teamSize, description, 
            rules, startTime, endTime, 
            venue, registrationAmount, prizePool,
            registrationFrom, registrationLink  // Add these fields
        } = req.body;

        const needsSizeLimits = type === 'Team' || type === 'Combined';
        const sizeLimits = needsSizeLimits ? {
            min: parseInt(teamSize.min) || 1,
            max: parseInt(teamSize.max) || 1
        } : { min: 1, max: 1 };

        let updateData = {
            name,
            type,
            teamSize: sizeLimits,
            description,
            rules: Array.isArray(rules) ? rules.filter(rule => rule.trim()) : [rules],
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            venue,
            registrationAmount: parseInt(registrationAmount),
            prizePool: parseInt(prizePool),
            registrationFrom,
            registrationLink: registrationFrom === 'external' ? registrationLink : null
        };

        // if (req.files) {
        //     const result = await new Promise((resolve, reject) => {
        //         let cld_upload_stream = cloudinary.uploader.upload_stream(
        //             {
        //                 folder: 'revelation2k25/events',
        //             },
        //             (error, result) => {
        //                 if (error) reject(error);
        //                 else resolve(result);
        //             }
        //         );
        //         streamifier.createReadStream(req.files.buffer).pipe(cld_upload_stream);
        //     });

        //     updateData.posterImage = {
        //         url: result.secure_url,
        //         filename: result.public_id
        //     };
        // }

        const event = await Event.findByIdAndUpdate(
            req.params.id, 
            updateData,
            { new: true, runValidators: true }
        );

        if (!event) {
            return res.status(404).send('Event not found');
        }

        res.redirect(`/admin/event/${event._id}`);
    } catch (error) {
        console.error('Error updating event:', error);
        return res.render('admin/event/edit', { 
            event: { ...req.body, _id: req.params.id }, 
            error: error.message 
        });
    }
};

module.exports.toggleEventStatus = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        event.isRegistrationOpen = !event.isRegistrationOpen;
        await event.save();

        res.json({ 
            success: true, 
            isRegistrationOpen: event.isRegistrationOpen 
        });
    } catch (error) {
        console.error('Error toggling event status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating event status' 
        });
    }
};


module.exports.getAllUsersPage = async (req, res) => {
    try {
        const users = await User.find({ type: 'normal' }).sort({ name: 'asc' });
        
        const usersWithRegistrations = await Promise.all(users.map(async (user) => {
            const [individualRegs, teamRegs] = await Promise.all([
                EventRegistration.find({
                    userId: user._id,
                    registrationType: 'individual'
                }).countDocuments(),
                Team.find({
                    $or: [
                        { teamLeader: user._id },
                        { teamMembers: user._id }
                    ]
                }).countDocuments()
            ]);

            const totalEvents = individualRegs + teamRegs;

            return {
                ...user.toObject(),
                registrationCount: totalEvents
            };
        }));

        return res.render('admin/users/index', { 
            users: usersWithRegistrations,
            title: 'All Users',
            path: '/users'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', {
            message: 'Error fetching users',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

exports.getUserByIdPage = async (req, res) => {
    try {
        const [user, individualRegistrations, teams] = await Promise.all([
            User.findById(req.params.id),
            EventRegistration.find({
                userId: req.params.id,
                registrationType: 'individual'
            }).populate('event'),
            Team.find({
                $or: [
                    { teamLeader: req.params.id },
                    { teamMembers: req.params.id }
                ]
            }).populate('teamLeader', 'name email')
              .populate('teamMembers', 'name email')
        ]);

        // console.log(individualRegistrations)

        if (!user) {
            return res.status(404).render('error', {
                message: 'User not found',
                error: {}
            });
        }

        // const teamRegistrations = await EventRegistration.find({
        //     teamId: { $in: teams.map(team => team._id) },
        //     registrationType: 'team'
        // }).populate('event');

        // console.log(teamRegistrations)

        // const teamParticipations = teams.map(team => {
        //     const registration = teamRegistrations.find(reg => 
        //         reg.teamId.toString() === team._id.toString()
        //     );
        //     return {
        //         team: team,
        //         event: registration?.event,
        //         registeredAt: registration?.registeredAt,
        //         isLeader: team.teamLeader._id.toString() === user._id.toString()
        //     };
        // });

        // // console.log({individualRegistrations, teamParticipations});
        // res.render('admin/users/show', {
        //     user,
        //     registrations: {
        //         individual: individualRegistrations,
        //         team: teamParticipations
        //     },
        //     title: user.name,
        //     path: '/users'
        // });
        const teamIds = teams.map(team => team._id);

        const teamRegistrations = await EventRegistration.find({
            teamId: { $in: teamIds },
            registrationType: 'team'
        }).populate('event');

        const teamParticipations = teams.map(team => {
            const registration = teamRegistrations.find(reg => 
                reg.teamId.toString() === team._id.toString()
            );
            return {
                team,
                event: registration?.event || null,
                registeredAt: registration?.registeredAt || null,
                isLeader: team.teamLeader?._id.toString() === user._id.toString()
            };
        });

        return res.render('admin/users/show', {
            user,
            registrations: {
                individual: individualRegistrations,
                team: teamParticipations
            },
            title: user.name,
            path: '/users'
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).render('error', {
            message: 'Error fetching user details',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

module.exports.getAllEventsPage = async (req, res) => {
    try {
        const events = await Event.find().sort({ startTime: 'asc' });
        res.render('admin/events/index.ejs', { events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Error fetching events');
    }
};

module.exports.getEventByIdPage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.render('error', { 
                title: 'Error',
                message: 'Event not found',
                error: null,
                path: '/events'
            });
        }
        res.render('admin/events/show', { 
            event,
            title: event.name,
            path: '/events'
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.render('error', { 
            title: 'Error',
            message: 'Error fetching event details',
            error: process.env.NODE_ENV === 'development' ? error : null,
            path: '/events'
        });
    }
};

module.exports.getAllTeamsPage = async (req, res) => {
    try {
        const [teams, events] = await Promise.all([
            Team.find()
                .populate('teamLeader', 'name email picture isIIESTian')
                .populate('teamMembers', 'name email picture isIIESTian')
                .sort({ _id: -1 }),
            Event.find()
        ]);

        const teamsWithRegistrations = await Promise.all(teams.map(async (team) => {
            const registration = await EventRegistration.findOne({ teamId: team._id })
                .populate('event');
            
            return {
                ...team.toObject(),
                eventRegistered: registration?.event || null,
                registeredAt: registration?.registeredAt || null
            };
        }));

        res.render('admin/teams/index', {
            teams: teamsWithRegistrations,
            events,
            title: 'All Teams',
            path: '/teams'
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).render('error', {
            message: 'Error fetching teams',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

exports.getTeamById = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('teamLeader', 'name email picture isIIESTian')
            .populate('teamMembers', 'name email picture isIIESTian')
            .exec();

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const registration = await EventRegistration.findOne({ 
            teamId: team._id,
            registrationType: 'team'
        }).populate('event').exec();

        const teamData = {
            ...team.toObject(),
            eventRegistered: registration?.event || null,
            registeredAt: registration?.registeredAt || null,
            paymentProof: registration?.paymentProof || null
        };

        res.json(teamData);
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ message: 'Error fetching team details' });
    }
};

exports.getTeamByIdPage = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('teamLeader')
            .populate('teamMembers');
        
        const registration = await EventRegistration.findOne({ teamId: team._id })
            .populate('event');
            
        if (!team) {
            return res.status(404).render('admin/error', { 
                error: 'Team not found',
                title: 'Error',
                path: '/teams'
            });
        }

        const teamData = {
            ...team.toObject(),
            eventRegistered: registration?.event || null,
            registeredAt: registration?.registeredAt || null,
            paymentProof: registration?.paymentProof || null
        };

        res.render('admin/teams/show', { 
            team: teamData,
            title: team.name,
            path: '/teams'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).render('admin/error', { 
            error: 'Failed to load team details',
            title: 'Error',
            path: '/teams'
        });
    }
};

module.exports.getAllRegistrationsPage = async (req, res) => {
    try {
        const registrations = await EventRegistration.find()
            .populate('event')
            .populate('userId', 'name email isIIESTian picture')
            .populate({
                path: 'teamId',
                populate: {
                    path: 'teamLeader teamMembers',
                    select: 'name email picture isIIESTian'
                }
            })
            .sort({ registeredAt: -1 });

        return res.render('admin/registrations', {
            registrations,
            title: 'All Registrations',
            path: 'registrations',
            error: null
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).render('error', {
            message: 'Error fetching registrations',
            error: process.env.NODE_ENV === 'development' ? error : {},
            layout: false
        });
    }
};

module.exports.getEventParticipantsPage = async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).render('error', { 
                message: 'Event not found',
                error: {}
            });
        }

        let participants = [];

        if (event.type === 'Single') {
            // For single events, find users who have this event in their eventsRegistered array
            participants = await User.find({
                'eventsRegistered': {
                    $elemMatch: {
                        id: eventId,
                        team: false
                    }
                }
            }).select('name email phoneNumber isIIESTian picture');
        } else {
            const allRegs= await EventRegistration.find({event: eventId}).populate('teamId');
            participants = allRegs;
        }

        return res.render('admin/events/participants', {
            event,
            participants,
            title: `${event.name} - Participants`,
            path: '/events'
        });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).render('error', {
            message: 'Error fetching participants',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};


module.exports.toggleIsLive= async(req, res)=>{
    try{
        const {id}= req.params;
        const event= await Event.findById(id);

        if(!event){
            return res.status(404).json({message: "Event not found"});
        }

        event.isRegistrationOpen= !event.isRegistrationOpen;
        event.save();
        return res.redirect(`/admin/event/${id}`);
    }catch(error){
        return res.status(500).json({message: "Failed to toggle"})
    }
}

/*
module.exports.deleteEventRegistration= async(req, res)=>{
    try{
        const {id}= req.params;
        const eventRegistration= await EventRegistration.findById(id);

        if(!eventRegistration){
            return res.status(404).json({message: "Event Registration not found"});
        }

        if(eventRegistration.type==='team'){
            const team= await Team.findById(eventRegistration.teamId)
            console.log(team);
            return res.send(team);
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
            await EventRegistration.deleteMany({ teamId: eventRegistration.teamId });
        }else{
            await User.updateMany(
                { _id: eventRegistration.userId },
                { 
                    $pull: { 
                        eventsRegistered: { 
                            team: false, 
                            id: eventRegistration.event
                        } 
                    } 
                }
            );
            await EventRegistration.findByIdAndDelete(id);
        }

        return res.redirect('/admin/registrations');
    }catch(error){
        return res.status(500).json({message: "Failed to delete registration"})
    }
}
*/

module.exports.gradeParticipantsPage= async(req, res)=>{
    try{
        const allEvents= await Event.find({registrationFrom: 'website'});

        return res.render('admin/grade/gradeParticipantsAll.ejs', {allEvents});

    }catch(error){
        console.error('Error fetching grade participants page:', error);
        return res.status(500).render('error', {
            message: 'Error fetching grade participants page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
}

// module.exports.gradeParticipantsOfEventPage= async(req, res)=>{
//     try{
//         const {id}= req.params;
//         const {round}= req.params;

//         const event= await Event.findById(id);
//         if(!event){
//             return res.status(404).json({message: "Event not found"});
//         }

//         const grades= await Grade.find({event: id, round});
//         const previousGrades= await Grade.find({event: id, round: (round-1)})

//         const allRegs= await EventRegistration.find({event: id}).populate('userId teamId');

//         return res.render('admin/grade/gradeParticipantsEvent.ejs', {allRegs, event, grades, previousGrades});
//     }catch(error){
//         console.error('Error fetching grade participants for event page:', error);
//         return res.status(500).render('error', {
//             message: 'Error fetching grade participants for event page',
//             error: process.env.NODE_ENV === 'development' ? error : {}
//         });
//     }
// }
// module.exports.gradeParticipantsOfEventPage = async (req, res) => {
//     try {
//         const { id, round } = req.params;

//         // Find the event
//         const event = await Event.findById(id);
//         if (!event) {
//             return res.status(404).json({ message: "Event not found" });
//         }

//         // Fetch all grades for the event
//         const allGrades = await Grade.find({ event: id }).sort({ round: 1 });

//         // Fetch grades for the current round
//         const currentRoundGrades = allGrades.filter(g => g.round === parseInt(round));

//         // Fetch all registrations for the event
//         const allRegs = await EventRegistration.find({ event: id }).populate('userId teamId');

//         // Render the EJS template with the correct data
//         return res.render('admin/grade/gradeParticipantsEvent.ejs', {
//             allRegs,
//             event,
//             allGrades, // Pass all rounds data to the frontend
//             currentRound: parseInt(round), // Pass the current round to the frontend
//             currentRoundGrades // Pass grades for the current round
//         });

//     } catch (error) {
//         console.error('Error fetching grade participants for event page:', error);
//         return res.status(500).render('error', {
//             message: 'Error fetching grade participants for event page',
//             error: process.env.NODE_ENV === 'development' ? error : {}
//         });
//     }
// };
module.exports.gradeParticipantsOfEventPage = async (req, res) => {
    try {
        const { id, round } = req.params;
        const currentRound = parseInt(round);

        // Find the event
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Fetch all grades for the event
        const allGrades = await Grade.find({ event: id }).sort({ round: 1 });

        // Fetch grades for the current round
        const currentRoundGrades = allGrades.filter(g => g.round === currentRound);

        // Fetch all registrations for the event
        let allRegs = await EventRegistration.find({ event: id }).populate('userId teamId');

        // Check if there are previous rounds
        if (currentRound > 1) {
            // Get all previous rounds' grades
            const previousRoundsGrades = allGrades.filter(g => g.round < currentRound);

            // Get disqualified participants from all previous rounds
            const disqualifiedParticipants = new Set();
            previousRoundsGrades.forEach(grade => {
                if (event.type === 'Team') {
                    grade.teams.forEach(team => {
                        if (team.isDisqualified) disqualifiedParticipants.add(team.id.toString());
                    });
                } else {
                    grade.users.forEach(user => {
                        if (user.isDisqualified) disqualifiedParticipants.add(user.id.toString());
                    });
                }
            });

            // Filter out disqualified participants
            allRegs = allRegs.filter(reg => {
                const participantId = event.type === 'Team' ? reg.teamId?._id.toString() : reg.userId?._id.toString();
                return !disqualifiedParticipants.has(participantId);
            });
        }

        // Render the EJS template with the correct data
        return res.render('admin/grade/gradeParticipantsEvent.ejs', {
            allRegs,
            event,
            allGrades, // Pass all rounds data to the frontend
            currentRound, // Pass the current round to the frontend
            currentRoundGrades // Pass grades for the current round
        });

    } catch (error) {
        console.error('Error fetching grade participants for event page:', error);
        return res.status(500).render('error', {
            message: 'Error fetching grade participants for event page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
// module.exports.toggleQualifyParticipant= async(req, res)=>{
//     try{
//         const {eventId, round}= req.params;
//         const event= await Event.findById(eventId);

//         if(!event){
//             return res.status(404).json({message: "Event not found"});
//         }

//         if(event.type==='Team'){
//             const grades= await Grade.find({event: id, round});
//         }else if(event.type==='Single'){
//             const grades= await Grade.find({event: id, round});     
//         }

        
//     }catch(error){
//         console.error('Error changing qualification status of participant:', error);
//         return res.status(500).render('error', {
//             message: 'Error changing qualification status of participant',
//             error: process.env.NODE_ENV === 'development' ? error : {}
//         });
//     }
// }

module.exports.toggleQualifyParticipant = async (req, res) => {
    try {
        const { eventId, round, participantId } = req.params;

        // Trim the participantId to remove any leading/trailing spaces
        const trimmedParticipantId = participantId.trim();

        // Validate that the participantId is a valid ObjectId
        if (!mongoose.isValidObjectId(trimmedParticipantId)) {
            return res.status(400).json({ message: "Invalid participant ID" });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        let previousGrades = await Grade.find({ event: eventId });
        let maxRound = previousGrades.length > 0 ? Math.max(...previousGrades.map(g => g.round)) : 0;

        let grades = await Grade.find({ event: eventId, round });
        let grade = grades.length > 0 ? grades[0] : null;

        if (!grade) {
            grade = new Grade({ event: eventId, round: maxRound + 1, users: [], teams: [] });
        } else {
            grade.teams = grade.teams || [];
            grade.users = grade.users || [];
        }

        if (event.type === 'Team') {
            const teamIndex = grade.teams.findIndex(t => t.id.toString() === trimmedParticipantId);
            if (teamIndex !== -1) {
                grade.teams[teamIndex].isDisqualified = !grade.teams[teamIndex].isDisqualified;
            } else {
                grade.teams.push({ id: trimmedParticipantId, isDisqualified: true });
            }
        } else {
            const userIndex = grade.users.findIndex(u => u.id.toString() === trimmedParticipantId);
            if (userIndex !== -1) {
                grade.users[userIndex].isDisqualified = !grade.users[userIndex].isDisqualified;
            } else {
                grade.users.push({ id: trimmedParticipantId, isDisqualified: true });
            }
        }

        await grade.save();
        return res.redirect(`/admin/grade-participants/${eventId}/${round}`);
        // return res.status(200).json({ message: "Participant qualification status updated successfully" });

    } catch (error) {
        console.error('Error changing qualification status of participant:', error);
        return res.status(500).render('error', {
            message: 'Error changing qualification status of participant',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// module.exports.submitPoints = async (req, res) => {
//     try {
//         const { eventId, round } = req.params;
//         const { grades } = req.body; // grades should be an array of { participantId, points }

//         // Find the event
//         const event = await Event.findById(eventId);
//         if (!event) {
//             return res.status(404).json({ message: "Event not found" });
//         }

//         // Find or create the grade document for the current round
//         let grade = await Grade.findOne({ event: eventId, round: parseInt(round) });
//         if (!grade) {
//             grade = new Grade({ event: eventId, round: parseInt(round), users: [], teams: [] });
//         }

//         // Update points for each participant
//         grades.forEach(g => {
//             if (event.type === 'Team') {
//                 const teamIndex = grade.teams.findIndex(t => t.id.toString() === g.participantId);
//                 if (teamIndex !== -1) {
//                     grade.teams[teamIndex].grade = g.points;
//                 } else {
//                     grade.teams.push({ id: g.participantId, grade: g.points, isDisqualified: false });
//                 }
//             } else {
//                 const userIndex = grade.users.findIndex(u => u.id.toString() === g.participantId);
//                 if (userIndex !== -1) {
//                     grade.users[userIndex].grade = g.points;
//                 } else {
//                     grade.users.push({ id: g.participantId, grade: g.points, isDisqualified: false });
//                 }
//             }
//         });

//         // Save the updated grade document
//         await grade.save();
//         return res.status(200).json({ message: "Points submitted successfully" });

//     } catch (error) {
//         console.error('Error submitting points:', error);
//         return res.status(500).json({ message: 'Error submitting points' });
//     }
// };
module.exports.submitPoints = async (req, res) => {
    try {
        const { eventId, round } = req.params;
        const { grades } = req.body;

        console.log("Received grades:", grades);

        if (!Array.isArray(grades)) {
            return res.status(400).json({ message: "Invalid data format" });
        }

        // Find the event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Find or create the grade document for the current round
        let gradeDoc = await Grade.findOne({ event: eventId, round: parseInt(round) });
        if (!gradeDoc) {
            gradeDoc = new Grade({ event: eventId, round: parseInt(round), users: [], teams: [] });
        }

        // Ensure IDs are properly formatted
        const isTeamEvent = event.type === 'Team';

        grades.forEach(g => {
            const participantId = g.participantId.toString();
            const points = g.points; // Fix incorrect field

            if (isTeamEvent) {
                let team = gradeDoc.teams.find(t => t.id.toString() === participantId);
                if (team) {
                    team.grade = points;
                } else {
                    gradeDoc.teams.push({ id: participantId, grade: points, isDisqualified: false });
                }
            } else {
                let user = gradeDoc.users.find(u => u.id.toString() === participantId);
                if (user) {
                    user.grade = points;
                } else {
                    gradeDoc.users.push({ id: participantId, grade: points, isDisqualified: false });
                }
            }
        });

        // Mark document as modified before saving
        gradeDoc.markModified('users');
        gradeDoc.markModified('teams');

        // Save the updated grade document
        await gradeDoc.save();
        return res.status(200).json({ message: "Grades submitted successfully" });

    } catch (error) {
        console.error('Error submitting grades:', error);
        return res.status(500).json({ message: 'Error submitting grades' });
    }
};



module.exports.editRoundDetailsPage = async (req, res) => {
    try {
        const { eventId, round } = req.params;

        // Find the event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Fetch the grade document for the current round
        const grade = await Grade.findOne({ event: eventId, round: parseInt(round) });

        // Fetch all registrations for the event
        const allRegs = await EventRegistration.find({ event: eventId }).populate('userId teamId');

        // Render the EJS template with the correct data
        return res.render('admin/grade/editRoundDetails.ejs', {
            allRegs,
            event,
            grade,
            currentRound: parseInt(round)
        });

    } catch (error) {
        console.error('Error fetching round details for editing:', error);
        return res.status(500).render('error', {
            message: 'Error fetching round details for editing',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// module.exports.createAndShareEventSheet = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const event = await Event.findById(id);

//         if (!event) {
//             return res.status(404).json({ message: "Event not found" });
//         }

//         // Helper function to build team rows with proper null checks
//         const buildTeamRow = (registration, maxTeamMembers) => {
//             const team = registration.teamId || {};
//             const row = [
//                 registration.event.name,
//                 team.name || '-',
//                 team.teamLeader?.name || '-',
//                 team.teamLeader?.email || '-',
//                 team.leaderPhone || '-'
//             ];

//             const members = team.teamMembers || [];
//             for (let i = 0; i < maxTeamMembers; i++) {
//                 row.push(members[i]?.name || '-');
//                 row.push(members[i]?.email || '-');
//             }

//             row.push(registration.registeredAt.toLocaleString());
//             return row;
//         };

//         // Check if a Google Sheet already exists
//         let googleSheet = await GoogleSheet.findOne({ event: id });

//         if (!googleSheet) {
//             const spreadsheet = await sheets.spreadsheets.create({
//                 resource: { properties: { title: `Event Registrations - ${event.name}` } }
//             });

//             const spreadsheetId = spreadsheet.data.spreadsheetId;
//             const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

//             googleSheet = new GoogleSheet({ event: id, googleSheetId: spreadsheetId, googleSheetUrl: sheetUrl });
//             await googleSheet.save();

//             // Fetch registrations
//             const registrations = await EventRegistration.find({ event: id })
//                 .populate('event')
//                 .populate('userId')
//                 .populate({
//                     path: 'teamId',
//                     populate: { path: 'teamLeader teamMembers' }
//                 })
//                 .sort({ registeredAt: -1 });

//             let values = [];
//             if (event.type === 'Single') {
//                 values.push(['Event Name', 'User Name', 'User Email', 'Phone Number', 'Registered At']);
//                 registrations.forEach(reg => {
//                     values.push([
//                         reg.event.name,
//                         reg.userId.name,
//                         reg.userId.email,
//                         reg.userId.phoneNumber,
//                         reg.registeredAt.toLocaleString()
//                     ]);
//                 });
//             } else if (event.type === 'Team') {
//                 const header = ['Event Name', 'Team Name', 'Leader Name', 'Leader Email', 'Leader Phone No.'];
//                 const maxMembers = event.teamSize.max - 1;
                
//                 for (let i = 1; i <= maxMembers; i++) {
//                     header.push(`Member ${i} Name`, `Member ${i} Email`);
//                 }
//                 header.push('Registered At');
//                 values.push(header);

//                 registrations.forEach(reg => {
//                     values.push(buildTeamRow(reg, maxMembers));
//                 });
//             }

//             await sheets.spreadsheets.values.update({
//                 spreadsheetId: googleSheet.googleSheetId,
//                 range: 'Sheet1!A1',
//                 valueInputOption: 'RAW',
//                 resource: { values },
//             });

//             await sheets.spreadsheets.batchUpdate({
//                 spreadsheetId: googleSheet.googleSheetId,
//                 resource: { requests: [{
//                     autoResizeDimensions: {
//                         dimensions: {
//                             sheetId: 0,
//                             dimension: 'COLUMNS',
//                             startIndex: 0,
//                             endIndex: values[0].length,
//                         },
//                     },
//                 }]},
//             });

//             await drive.permissions.create({
//                 fileId: googleSheet.googleSheetId,
//                 requestBody: { role: 'writer', type: 'anyone' },
//             });

//             googleSheet.lastUpdated = Date.now();
//             await googleSheet.save();
//             return res.send(`<a href="${googleSheet.googleSheetUrl}" target="_blank">Open Sheet</a>`);
//         }

//         // Existing sheet handling
//         const existingData = await sheets.spreadsheets.values.get({
//             spreadsheetId: googleSheet.googleSheetId,
//             range: 'Sheet1!A:Z',
//         });

//         const existingRows = existingData.data.values || [];
//         const headerRow = existingRows[0];
//         const existingEmails = new Set();

//         for (let i = 1; i < existingRows.length; i++) {
//             const email = event.type === 'Single' ? existingRows[i][2] : existingRows[i][3];
//             existingEmails.add(email.toLowerCase());
//         }

//         const registrations = await EventRegistration.find({ event: id })
//             .populate('event')
//             .populate('userId')
//             .populate({
//                 path: 'teamId',
//                 populate: { path: 'teamLeader teamMembers' }
//             })
//             .sort({ registeredAt: -1 });

//         const updatedValues = [headerRow];
//         const maxTeamMembers = event.type === 'Team' ? event.teamSize.max - 1 : 0;

//         // Step 1: Remove deleted entries with proper null checks
//         const seenEmails = new Set();
//         for (let i = 1; i < existingRows.length; i++) {
//             const row = existingRows[i];
//             const email = (event.type === 'Single' ? row[2] : row[3])?.toLowerCase();
            
//             const exists = registrations.some(reg => {
//                 if (event.type === 'Single') {
//                     return reg.userId.email.toLowerCase() === email;
//                 } else {
//                     return reg.teamId?.teamLeader?.email?.toLowerCase() === email;
//                 }
//             });

//             // Prevent duplicate entries
//             if (exists && !seenEmails.has(email)) {
//                 updatedValues.push(row);
//                 seenEmails.add(email);
//             }
//         }

//         // Step 2: Add new entries with email deduplication
//         registrations.forEach(registration => {
//             const email = event.type === 'Single' 
//                 ? registration.userId.email.toLowerCase()
//                 : registration.teamId?.teamLeader?.email?.toLowerCase();

//             if (email && !existingEmails.has(email)) {
//                 const row = event.type === 'Single' ? [
//                     registration.event.name,
//                     registration.userId.name,
//                     registration.userId.email,
//                     registration.userId.phoneNumber,
//                     registration.registeredAt.toLocaleString()
//                 ] : buildTeamRow(registration, maxTeamMembers);
                
//                 if (!updatedValues.some(r => r[event.type === 'Single' ? 2 : 3]?.toLowerCase() === email)) {
//                     updatedValues.push(row);
//                 }
//             }
//         });

//         // Step 3: Update sheet
//         await sheets.spreadsheets.values.update({
//             spreadsheetId: googleSheet.googleSheetId,
//             range: 'Sheet1!A1',
//             valueInputOption: 'RAW',
//             resource: { values: updatedValues },
//         });

//         await sheets.spreadsheets.batchUpdate({
//             spreadsheetId: googleSheet.googleSheetId,
//             resource: { requests: [{
//                 autoResizeDimensions: {
//                     dimensions: {
//                         sheetId: 0,
//                         dimension: 'COLUMNS',
//                         startIndex: 0,
//                         endIndex: updatedValues[0].length,
//                     },
//                 },
//             }]},
//         });

//         googleSheet.lastUpdated = Date.now();
//         await googleSheet.save();
//         res.send(`<a href="${googleSheet.googleSheetUrl}" target="_blank">Open Sheet</a>`);

//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).send('Error processing sheet');
//     }
// };

module.exports.createAndShareEventSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);

        if (!event || event.type !== 'Single') {
            return res.status(404).json({ message: "Cant create excel for this" });
        }

        let googleSheet = await GoogleSheet.findOne({ event: id });

        if (!googleSheet) {
            const spreadsheet = await sheets.spreadsheets.create({
                resource: { properties: { title: `Event Registrations - ${event.name}` } }
            });

            googleSheet = new GoogleSheet({
                event: id,
                googleSheetId: spreadsheet.data.spreadsheetId,
                googleSheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheet.data.spreadsheetId}`
            });
            await googleSheet.save();
        }

        // Get existing sheet data
        const existingData = await sheets.spreadsheets.values.get({
            spreadsheetId: googleSheet.googleSheetId,
            range: 'Sheet1!A:Z',
        });

        const existingRows = existingData.data.values || [];
        const header = existingRows[0] || ['Event Name', 'User Name', 'User Email', 'Phone Number', 'Registered At'];
        const existingEmails = new Set(existingRows.slice(1).map(row => row[2]?.toLowerCase()));

        // Get current registrations
        const registrations = await EventRegistration.find({ event: id })
            .populate('userId')
            .sort({ registeredAt: -1 });

        // Prepare updated data
        const updatedValues = [header];

        // Update existing rows with clickable emails
        existingRows.slice(1).forEach(row => {
            const email = row[2]?.toLowerCase();
            if (existingEmails.has(email)) {
                updatedValues.push([
                    row[0], // Event Name
                    row[1], // User Name
                    `=HYPERLINK("mailto:${email}", "${email}")`, // Make email clickable
                    row[3], // Phone Number
                    row[4]  // Registered At
                ]);
            }
        });

        // Add new registrations
        registrations.forEach(registration => {
            const email = registration.userId.email.toLowerCase();
            if (!existingEmails.has(email)) {
                updatedValues.push([
                    event.name,
                    registration.userId.name,
                    `=HYPERLINK("mailto:${email}", "${email}")`,
                    registration.userId.phoneNumber,
                    registration.registeredAt.toLocaleString()
                ]);
            }
        });

        // Update sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId: googleSheet.googleSheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: updatedValues },
        });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: googleSheet.googleSheetId,
            resource: { requests: [{
                autoResizeDimensions: {
                    dimensions: {
                        sheetId: 0,
                        dimension: 'COLUMNS',
                        startIndex: 0,
                        endIndex: header.length
                    }
                }
            }]}
        });

        await drive.permissions.create({
            fileId: googleSheet.googleSheetId,
            requestBody: { role: 'writer', type: 'anyone' }
        });

        googleSheet.lastUpdated = Date.now();
        await googleSheet.save();

        return res.redirect(googleSheet.googleSheetUrl);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error processing sheet');
    }
};