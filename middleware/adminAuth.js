const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');

const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies.admin_token;
        
        // Pass token to views
        res.locals.adminToken = token;

        if (!token) {
            if (req.path === '/login') {
                return next();
            }
            return res.redirect('/admin/login');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user || user.type !== 'admin') {
                res.clearCookie('admin_token');
                if (req.path === '/login') {
                    return next();
                }
                return res.redirect('/admin/login');
            }

            if (req.path === '/login') {
                return res.redirect('/admin/dashboard');
            }

            req.admin = user;
            next();
        } catch (jwtError) {
            res.clearCookie('admin_token');
            return res.redirect('/admin/login');
        }
    } catch (error) {
        next(error);
    }
};

module.exports = adminAuth;
