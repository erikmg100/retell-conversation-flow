export default async function handler(req, res) {
    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📞 Creating v2 web call via individual route...');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { flowData } = req.body;
        
        // Check if environment variables are configured
        const apiKey = process.env.RETELL_API_KEY;
        const agentId = process.env.RETELL_AGENT_ID;
        
        if (!apiKey) {
            console.error('❌ RETELL_API_KEY not configured');
            return res.status(500).json({ 
                error: 'API key not configured',
                message: 'Please set RETELL_API_KEY in Vercel environment variables'
            });
        }
        
        if (!agentId) {
            console.error('❌ RETELL_AGENT_ID not configured');
            return res.status(500).json({ 
                error: 'Agent ID not configured',
                message: 'Please set RETELL_AGENT_ID in Vercel environment variables'
            });
        }
        
        console.log('🔑 Using API Key:', apiKey.substring(0, 20) + '...');
        console.log('🤖 Using Agent ID:', agentId);
        
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
        
        console.log('📝 Generated instructions:', instructions);
        
        // Create web call with Retell API
        const response = await fetch('https://api.retellai.com/v2/create-web-call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: agentId,
                metadata: {
                    flow_data: JSON.stringify(flowData),
                    instructions: instructions,
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        console.log('📡 Retell API Response Status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ Retell API Error:', errorData);
            throw new Error(`Retell API error: ${response.status} - ${errorData}`);
        }
        
        const webCall = await response.json();
        console.log('✅ Web call created successfully:', webCall.call_id);
        console.log('Access token received:', webCall.access_token?.substring(0, 20) + '...');
        
        res.json({
            success: true,
            accessToken: webCall.access_token,
            callId: webCall.call_id,
            version: 'v2-individual-routes'
        });
        
    } catch (error) {
        console.error('❌ API error:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Failed to create web call'
        });
    }
}
