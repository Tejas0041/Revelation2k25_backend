const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');

const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies.admin_token;
        if (!token) {
            if (req.path === '/login') {
                return next();
            }
            return res.redirect('/admin/login');
        }

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
    } catch (error) {
        res.clearCookie('admin_token');
        if (req.path === '/login') {
            return next();
        }
        res.redirect('/admin/login');
    }
};

module.exports = adminAuth;
