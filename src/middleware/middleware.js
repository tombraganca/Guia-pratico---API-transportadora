const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

const users = ['Diego', 'Robson', 'Victor'];

//Middleware Global

const ensureAuthenticated = (req, res, next) => {
    const authToken = req.headers.authorization;

    if (!authToken) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    if (/^Bearer$/i.test(authToken)) {
        return res.status(401).json({
            message: "Token malformatted"
        });
    }

    const [, token] = authToken.split(' ');
    try {
        const decoded = jwt.verify(token, 'secret');
        const { sub } = decoded;

        request.user = {
            id: sub,
        };

        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = ensureAuthenticated;


