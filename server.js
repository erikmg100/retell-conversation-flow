const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Simple CORS setup
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create web call endpoint
app.post('/api/create-web-call', async (req, res) => {
    try {
        console.log('Creating web call...');
        
        const { flowData } = req.body;
        
        const response = await fetch('https://api.retellai.com/v2/create-web-call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: process.env.RETELL_AGENT_ID
            })
        });

        if (!response.ok) {
            throw new Error(`Retell API error: ${response.status}`);
        }

        const data = await response.json();
        
        res.json({
            accessToken: data.access_token,
            callId: data.call_id
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// For Vercel
module.exports = app;

// For local development
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
