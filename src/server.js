const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Convert flow data to agent instructions
function buildAgentInstructions(flowData) {
    let instructions = "You are a helpful AI assistant. Follow this conversation flow:\n\n";
    
    // Find welcome message
    const welcomeNode = flowData.nodes.find(n => n.type === 'welcome');
    if (welcomeNode) {
        instructions += `GREETING: "${welcomeNode.description}"\n\n`;
    }
    
    // Add caller type responses
    const callerTypes = flowData.nodes.filter(n => n.type === 'caller-type');
    if (callerTypes.length > 0) {
        instructions += "CALLER TYPE RESPONSES:\n";
        callerTypes.forEach(node => {
            instructions += `- For ${node.title}: "${node.description}"\n`;
        });
        instructions += "\n";
    }
    
    // Add other responses
    const responses = flowData.nodes.filter(n => n.type === 'response');
    if (responses.length > 0) {
        instructions += "ADDITIONAL RESPONSES:\n";
        responses.forEach(node => {
            instructions += `- ${node.title}: "${node.description}"\n`;
        });
    }
    
    instructions += "\nAlways be helpful, professional, and follow the conversation flow above.";
    return instructions;
}

app.post('/api/create-web-call', async (req, res) => {
    try {
        console.log('Creating v2 web call with dynamic flow...');
        console.log('Agent ID:', process.env.RETELL_AGENT_ID);
        
        const flowData = req.body.flowData;
        const agentInstructions = buildAgentInstructions(flowData);
        
        console.log('Generated instructions:', agentInstructions);
        
        // First, update the agent with new instructions
        await fetch(`https://api.retellai.com/v2/update-agent`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: process.env.RETELL_AGENT_ID,
                prompt: agentInstructions
            })
        });
        
        // Then create the web call
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
                    instructions: agentInstructions
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API error: ${response.status} - ${errorData}`);
        }

        const webCall = await response.json();
        
        console.log('✅ Dynamic web call created:', webCall.call_id);
        
        res.json({
            accessToken: webCall.access_token,
            callId: webCall.call_id,
            version: 'v2-dynamic',
            instructions: agentInstructions
        });
        
    } catch (error) {
        console.error('❌ Error creating dynamic web call:', error.message);
        res.status(500).json({ 
            error: 'Failed to create web call: ' + error.message
        });
    }
});

app.get('/api/agent-config', (req, res) => {
    res.json({
        agentId: process.env.RETELL_AGENT_ID,
        hasApiKey: !!process.env.RETELL_API_KEY,
        version: 'v2-dynamic'
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`🤖 Agent ID configured: ${process.env.RETELL_AGENT_ID}`);
    console.log(`🔑 API Key configured: ${process.env.RETELL_API_KEY ? 'Yes' : 'No'}`);
    console.log(`📡 Using Retell API v2 with dynamic flow`);
});
