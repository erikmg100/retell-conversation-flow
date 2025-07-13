export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Creating v2 web call via individual route...');
        
        const { flowData } = req.body;
        
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
        
        // Create web call
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
            throw new Error(`Retell API error: ${response.status} - ${errorData}`);
        }

        const webCall = await response.json();
        console.log('✅ Individual route web call created:', webCall.call_id);
        
        res.json({
            accessToken: webCall.access_token,
            callId: webCall.call_id,
            version: 'v2-individual-routes'
        });

    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: error.message });
    }
}
