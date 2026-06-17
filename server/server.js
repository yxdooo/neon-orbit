const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'leaderboard.json');

// Initialize DB file if not exists
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
}

// Get Top 10 Scores
app.get('/api/leaderboard', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath));
        const top10 = data.sort((a, b) => b.score - a.score).slice(0, 10);
        res.json(top10);
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Post New Score
app.post('/api/leaderboard', (req, res) => {
    try {
        const { name, score, token } = req.body;
        if (!name || typeof score !== 'number' || !token) {
            return res.status(400).json({ error: 'Invalid data' });
        }
        
        const expectedToken = Buffer.from(`${score}-NEON-${name.substring(0, 3).toUpperCase()}`).toString('base64');
        if (token !== expectedToken) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        const data = JSON.parse(fs.readFileSync(dbPath));
        data.push({ name: name.substring(0, 3).toUpperCase(), score, date: new Date().toISOString() });
        fs.writeFileSync(dbPath, JSON.stringify(data));
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Neon Orbit Global Leaderboard running on port ${PORT}`);
});
