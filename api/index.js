const path = require('path');

// For serverless functions, we need to export handlers
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url, method } = req;

    try {
        if (url === '/api/agent-config' && method === 'GET') {
            return res.json({
                agentId: process.env.RETELL_AGENT_ID,
                hasApiKey: !!process.env.RETELL_API_KEY,
                version: 'v2-serverless'
            });
        }

        if (url === '/api/create-web-call' && method === 'POST') {
            console.log('Creating v2 web call...');
            
            const flowData = req.body.flowData;
            
            // Build agent instructions
            let instructions = "You are a helpful AI assistant. Follow this conversation flow:\n\n";
            
            const welcomeNode = flowData.nodes.find(n => n.type === 'welcome');
            if (welcomeNode) {
                instructions += `GREETING: "${welcomeNode.description}"\n\n`;
            }
            
            const callerTypes = flowData.nodes.filter(n => n.type === 'caller-type');
            if (callerTypes.length > 0) {
                instructions += "CALLER TYPE RESPONSES:\n";
                callerTypes.forEach(node => {
                    instructions += `- For ${node.title}: "${node.description}"\n`;
                });
            }
            
            console.log('Generated instructions:', instructions);
            
            // Create web call using fetch
            const response = await fetch('https://api.retellai.com/v2/create-web-call', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agent_id: process.env.RETELL_AGENT_ID,
                    metadata: {
                        flow_data: JSON.stringify(flowData),
                        instructions: instructions
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API error: ${response.status} - ${errorData}`);
            }

            const webCall = await response.json();
            console.log('✅ Serverless web call created:', webCall.call_id);
            
            return res.json({
                accessToken: webCall.access_token,
                callId: webCall.call_id,
                version: 'v2-serverless'
            });
        }

        // For all other routes, serve the HTML
        const fs = require('fs');
        const htmlPath = path.join(process.cwd(), 'public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        console.error('Serverless function error:', error);
        res.status(500).json({ error: error.message });
    }
};
