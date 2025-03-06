const User = require('../models/userSchema');
const Event = require('../models/eventSchema');
const Team = require('../models/teamSchema');
const EventRegistration = require('../models/eventRegistrationSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');


module.exports.loginPage = (req, res) => {
    res.render('admin/login', { error: null });
};

module.exports.login = async (req, res) => {
    const { name, password } = req.body;
    
    try {
        const admin = await User.findOne({ name, type: 'admin' });
        if (!admin || !(await admin.comparePassword(password))) {
            return res.render('admin/login', { error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.cookie('admin_token', token, { httpOnly: true });
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.render('admin/login', { error: 'Server error' });
    }
};

// Update dashboard stats to use EventRegistration
module.exports.dashboard = async (req, res) => {
    try {
        // Get current date for active events calculation
        const now = new Date();

        const [
            totalEvents,
            activeEvents,
            upcomingEvents,
            totalUsers,
            iiestianUsers,
            totalRegistrations,
            individualRegistrations,
            teamRegistrations
        ] = await Promise.all([
            Event.countDocuments(),
            Event.countDocuments({
                startTime: { $lte: now },
                endTime: { $gte: now }
            }),
            Event.countDocuments({
                startTime: { $gt: now }
            }),
            User.countDocuments({ type: 'normal' }),
            User.countDocuments({ type: 'normal', isIIESTian: true }),
            EventRegistration.countDocuments(),
            EventRegistration.countDocuments({ registrationType: 'individual' }),
            EventRegistration.countDocuments({ registrationType: 'team' })
        ]);

        const stats = {
            totalEvents,
            activeEvents,
            upcomingEvents,
            usersCount: {
                total: totalUsers,
                iiestian: iiestianUsers,
                nonIiestian: totalUsers - iiestianUsers
            },
            registrationsCount: {
                total: totalRegistrations,
                individual: individualRegistrations,
                team: teamRegistrations
            }
        };

        res.render('admin/dashboard', {
            title: 'Dashboard',
            path: '/dashboard',
            stats
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
            registrationAmount 
        } = req.body;

        const needsSizeLimits = type === 'Team' || type === 'Combined';
        const sizeLimits = needsSizeLimits ? {
            min: parseInt(teamSize.min) || 1,
            max: parseInt(teamSize.max) || 1
        } : { min: 1, max: 1 };

        if (!req.file) {
            return res.render('admin/events/new', { 
                error: 'Event poster is required',
                formData: req.body
            });
        }

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

            streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
        })
        .then(async (result) => {
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
                posterImage: {
                    url: result.secure_url,
                    filename: result.public_id
                }
            });

            await event.save();
            res.redirect('/admin/events');
        })
        .catch((error) => {
            console.error('Error creating event:', error);
            res.render('admin/events/new', { 
                error: 'Error uploading image. Please try again.',
                formData: req.body
            });
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.render('admin/event/new', { 
            error: error.message || 'Error creating event',
            formData: req.body
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

        // Update size limits logic
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

        // Handle new poster image if uploaded
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
        // Get all non-admin users with their registrations
        const users = await User.find({ type: 'normal' }).sort({ name: 'asc' });
        
        // Get registrations for each user
        const usersWithRegistrations = await Promise.all(users.map(async (user) => {
            const registrations = await EventRegistration.find({
                $or: [
                    { userId: user._id },
                    { 'teamId.teamLeader': user._id },
                    { 'teamId.teamMembers': user._id }
                ]
            }).populate('event');

            return {
                ...user.toObject(),
                registrations
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

module.exports.getUserByIdPage = async (req, res) => {
    try {
        const [user, registrations] = await Promise.all([
            User.findById(req.params.id),
            EventRegistration.find({
                $or: [
                    { userId: req.params.id },
                    { 'teamId.teamLeader': req.params.id },
                    { 'teamId.teamMembers': req.params.id }
                ]
            }).populate('event')
        ]);

        if (!user) {
            return res.status(404).render('error', {
                message: 'User not found',
                error: {}
            });
        }

        res.render('admin/users/show', {
            user,
            registrations,
            title: user.name,
            path: '/users'
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).render('error', {
            message: 'Error fetching user',
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
            return res.status(404).send('Event not found');
        }
        res.render('admin/events/show', { event });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('Error fetching event');
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

module.exports.getTeamById = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('teamLeader', 'name email picture isIIESTian')
            .populate('teamMembers', 'name email picture')
            .populate('event');

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const registration = await EventRegistration.findOne({ teamId: team._id })
            .populate('event');

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