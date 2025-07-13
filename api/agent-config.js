export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        res.json({
            agentId: process.env.RETELL_AGENT_ID,
            hasApiKey: !!process.env.RETELL_API_KEY,
            version: 'v2-individual-routes'
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
