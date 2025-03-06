require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require('cookie-parser');
const { connectDB } = require("./connectDB.js");
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

// Connect to database
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'admin/layout');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Add path to res.locals for nav highlighting
app.use((req, res, next) => {
    res.locals.path = req.path.split('/')[1] || 'dashboard';
    next();
});

// Middleware
app.use(express.static('public'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
    origin: "http://localhost:5173", 
    credentials: true 
}));
app.use(methodOverride('_method'));

// Routes
app.use('/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});