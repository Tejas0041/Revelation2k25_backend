const User = require('../models/userSchema');
const Event = require('../models/eventSchema');
const Team = require('../models/teamSchema');
const EventRegistration = require('../models/eventRegistrationSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');


module.exports.loginPage = (req, res) => {
    res.render('admin/login', { 
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
            name, type, teamSize, description, 
            rules, startTime, endTime, 
            venue, registrationAmount, prizePool
        } = req.body;

        if (!req.files || !req.files.poster || !req.files.backgroundImage) {
            return res.render('admin/events/new', { 
                error: 'Both poster and background image are required',
                formData: req.body,
                title: 'Create Event',
                path: '/events'
            });
        }

        const needsSizeLimits = type === 'Team' || type === 'Combined';
        const sizeLimits = needsSizeLimits ? {
            min: parseInt(teamSize.min) || 1,
            max: parseInt(teamSize.max) || 1
        } : { min: 1, max: 1 };

        const uploadImage = async (file) => {
            return new Promise((resolve, reject) => {
                let cld_upload_stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'revelation2k25/events',
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(file.buffer).pipe(cld_upload_stream);
            });
        };

        const [posterResult, backgroundResult] = await Promise.all([
            uploadImage(req.files.poster[0]),
            uploadImage(req.files.backgroundImage[0])
        ]);

        const event = new Event({
            name,
            type,
            teamSize: sizeLimits,
            description,
            rules,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            venue,
            registrationAmount: parseInt(registrationAmount),
            prizePool: parseInt(prizePool),
            posterImage: {
                url: posterResult.secure_url,
                filename: posterResult.public_id
            },
            backgroundImage: {
                url: backgroundResult.secure_url,
                filename: backgroundResult.public_id
            }
        });

        await event.save();
        res.redirect('/admin/events');
    } catch (error) {
        console.error('Error creating event:', error);
        res.render('admin/events/new', { 
            error: 'Error creating event: ' + error.message,
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
            venue, registrationAmount 
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
            rules,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            venue,
            registrationAmount: parseInt(registrationAmount)
        };

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                let cld_upload_stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'revelation2k25/events',
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
            });

            updateData.posterImage = {
                url: result.secure_url,
                filename: result.public_id
            };
        }

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

        if (!user) {
            return res.status(404).render('error', {
                message: 'User not found',
                error: {}
            });
        }

        const teamRegistrations = await EventRegistration.find({
            teamId: { $in: teams.map(team => team._id) },
            registrationType: 'team'
        }).populate('event');

        const teamParticipations = teams.map(team => {
            const registration = teamRegistrations.find(reg => 
                reg.teamId.toString() === team._id.toString()
            );
            return {
                team: team,
                event: registration?.event,
                registeredAt: registration?.registeredAt,
                isLeader: team.teamLeader._id.toString() === user._id.toString()
            };
        });

        res.render('admin/users/show', {
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

        res.render('admin/registrations', {
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
        const [event, registrations] = await Promise.all([
            Event.findById(eventId),
            EventRegistration.find({ event: eventId })
                .populate('event')
                .populate('userId', 'name email isIIESTian')
                .populate({
                    path: 'teamId',
                    populate: {
                        path: 'teamLeader teamMembers',
                        select: 'name email isIIESTian'
                    }
                })
                .sort({ registeredAt: -1 })
        ]);

        if (!event) {
            return res.status(404).render('error', { 
                message: 'Event not found',
                error: {}
            });
        }

        res.render('admin/events/participants', {
            event,
            registrations,
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