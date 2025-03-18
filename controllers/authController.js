const { OAuth2Client } = require("google-auth-library");
const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports.googleAuth = async (req, res) => {
    const { token } = req.body;
  
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { name, email, picture } = ticket.getPayload();
  
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, email, picture });
            user.isIIESTian = email.endsWith("@students.iiests.ac.in");
            await user.save();
        }
  
        const jwtToken = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: "48h" });
  
        return res.json({ token: jwtToken, user });
    } catch (err) {
        return res.status(400).json({ message: "Invalid Token", error: err.message });
    }
};

module.exports.status = (req, res) => {
    return res.status(200).json({ message: "Authenticated", user: req.user });
};