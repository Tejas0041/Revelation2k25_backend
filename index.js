require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require('cookie-parser');
const { connectDB } = require("./connectDB.js");
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'admin/layout');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

app.use((req, res, next) => {
    res.locals.path = req.path.split('/')[1] || 'dashboard';
    next();
});

app.use(express.static('public'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
    // origin: "http://localhost:5173", 
    origin: "https://revelation2k25-frontend-testing.vercel.app",
    credentials: true 
}));
app.use(methodOverride('_method'));

app.get('/', (req, res) => {
    return res.redirect('/admin/login');
});

app.use('/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).render('error', { layout: false });
        return;
    }
    
    if (req.accepts('json')) {
        res.status(404).json({ success: false, message: 'Not Found' });
        return;
    }
    
    res.status(404).type('txt').send('Not Found');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        layout: false,
        status: 500,
        message: 'Something broke!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});