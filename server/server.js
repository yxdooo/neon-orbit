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

const crypto = require('crypto');
const fsPromises = fs.promises;
const HMAC_SECRET = process.env.HMAC_SECRET || '6ceeff183930538521301fb1a80e56bf159dbf22b4bb9bc04968f93a437d56b7';

// Get Top 10 Scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        const fileContent = await fsPromises.readFile(dbPath, 'utf8');
        const data = JSON.parse(fileContent);
        const top10 = data.sort((a, b) => b.score - a.score).slice(0, 10);
        res.json(top10);
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Post New Score
app.post('/api/leaderboard', async (req, res) => {
    try {
        const { name, score, token } = req.body;
        if (!name || typeof score !== 'number' || !token) {
            return res.status(400).json({ error: 'Invalid data' });
        }
        
        // Prevent absurd scores (basic sanity check)
        if (score > 999999999 || score < 0) {
            return res.status(400).json({ error: 'Invalid score' });
        }
        
        const safeName = name.substring(0, 3).toUpperCase();
        const hmac = crypto.createHmac('sha256', HMAC_SECRET);
        hmac.update(`${score}-NEON-${safeName}`);
        const expectedToken = hmac.digest('hex');
        
        if (token !== expectedToken) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        // Use async read/write to avoid blocking the event loop
        const fileContent = await fsPromises.readFile(dbPath, 'utf8');
        const data = JSON.parse(fileContent);
        
        data.push({ name: safeName, score, date: new Date().toISOString() });
        
        await fsPromises.writeFile(dbPath, JSON.stringify(data));
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Neon Orbit Global Leaderboard running on port ${PORT}`);
});
