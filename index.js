import express from 'express';
import cors from 'cors';

const app = express();

// Configure CORS - Updated with your correct frontend domain
app.use(cors({
  origin: [
    'https://retell-conversation-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Retell AI Backend Server is running!',
    timestamp: new Date().toISOString(),
    env_check: process.env.RETELL_API_KEY ? 'API key found' : 'API key missing'
  });
});

// Helper function to create dynamic agent
async function createDynamicAgent(flowData) {
  try {
    const { conversationFlow, nodes } = flowData;
    
    if (!conversationFlow || !nodes) {
      console.log('No dynamic flow data, using default agent');
      return null;
    }
    
    // Create dynamic prompt for Retell AI
    const systemPrompt = `You are a helpful AI assistant following a custom conversation flow.

WELCOME MESSAGE: Start every conversation with: "${conversationFlow.welcomeMessage}"

CONVERSATION BRANCHES: After the welcome, listen for user responses and match them to these options:
${conversationFlow.branches.map((branch, index) => `
${index + 1}. OPTION: "${branch.title}"
   KEYWORDS TO LISTEN FOR: ${branch.keywords.join(', ')}
   EXACT RESPONSE: "${branch.response}"
`).join('')}

INSTRUCTIONS:
1. Always start with the welcome message
2. After welcome, listen carefully to what the user says
3. Match their response to the closest branch based on keywords
4. Respond EXACTLY with the configured response text for that branch
5. If the user's response doesn't clearly match any branch, politely ask them to clarify which option they're interested in
6. Keep your tone natural and conversational
7. Don't add extra information beyond what's specified in the responses

Remember: Use the EXACT response text provided for each branch - don't paraphrase or add to it.`;

    console.log('Creating dynamic agent with prompt:', systemPrompt);

    // Create agent using Retell API
    const agentResponse = await fetch('https://api.retellai.com/v2/agent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: `Dynamic Flow Agent - ${Date.now()}`,
        voice_id: "11labs-Adrian",
        response_engine: {
          type: "retell_llm",
          llm_id: "retell-llm-8b-20240615",
        },
        begin_message: conversationFlow.welcomeMessage,
        general_prompt: systemPrompt,
        general_tools: [],
        ambient_sound_enabled: false,
        backchanneling_enabled: true,
        interruption_sensitivity: 1,
        language: "en-US",
        responsiveness: 1,
        speed: 1,
      })
    });

    if (!agentResponse.ok) {
      throw new Error(`Failed to create agent: ${agentResponse.status} ${agentResponse.statusText}`);
    }

    const agent = await agentResponse.json();
    console.log('Created dynamic agent:', agent.agent_id);
    return agent.agent_id;

  } catch (error) {
    console.error('Error creating dynamic agent:', error);
    return null;
  }
}

// Create web call endpoint (enhanced with dynamic agent support)
app.post('/create-web-call', async (req, res) => {
  try {
    console.log('Creating web call...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    let agentId = process.env.RETELL_AGENT_ID; // Default agent ID
    
    // Check if we have dynamic flow data
    if (req.body.flowData && req.body.flowData.conversationFlow) {
      console.log('Dynamic flow data detected, creating custom agent...');
      const dynamicAgentId = await createDynamicAgent(req.body.flowData);
      
      if (dynamicAgentId) {
        agentId = dynamicAgentId;
        console.log('Using dynamic agent:', agentId);
      } else {
        console.log('Failed to create dynamic agent, falling back to default agent:', agentId);
      }
    } else {
      console.log('No dynamic flow data, using default agent:', agentId);
    }
    
    // Create web call with the chosen agent
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: {
          flow_type: req.body.flowData ? 'dynamic' : 'default',
          nodes_count: req.body.flowData?.nodes?.length || 0,
          created_at: new Date().toISOString(),
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Retell API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const webCallResponse = await response.json();
    
    console.log('Web call created successfully:', webCallResponse.call_id);
    
    res.json({
      success: true,
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id,
      agent_id: webCallResponse.agent_id,
      flow_type: req.body.flowData ? 'dynamic' : 'default',
      flow_summary: req.body.flowData ? {
        welcome_message: req.body.flowData.conversationFlow?.welcomeMessage,
        branches_count: req.body.flowData.conversationFlow?.branches?.length || 0,
        nodes_count: req.body.flowData.nodes?.length || 0,
      } : null
    });

  } catch (error) {
    console.error('Error creating web call:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create web call',
      details: 'Check server logs for more information'
    });
  }
});

app.options('*', cors());

// Export for Vercel
export default app;
