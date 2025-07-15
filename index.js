import express from 'express';
import cors from 'cors';

const app = express();

// Store conversation flows temporarily (in production, use a database)
const conversationFlows = new Map();

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

// Custom LLM Webhook endpoint
app.post('/llm-webhook', async (req, res) => {
  try {
    const { call_id, conversation_id, message } = req.body;
    
    console.log('LLM Webhook called:', { call_id, conversation_id, message });
    
    // Get the conversation flow for this call
    const flowData = conversationFlows.get(call_id);
    
    if (!flowData || !flowData.conversationFlow) {
      // Fallback response if no flow data
      return res.json({
        response: "Hello! How can I help you today?",
        response_id: Date.now()
      });
    }
    
    const { conversationFlow } = flowData;
    const userMessage = message[message.length - 1]?.content || '';
    const isFirstMessage = message.length <= 1;
    
    let response;
    
    if (isFirstMessage) {
      // First message - use welcome message
      response = conversationFlow.welcomeMessage;
    } else {
      // Find matching branch based on user input
      const matchedBranch = conversationFlow.branches.find(branch => {
        return branch.keywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword.toLowerCase())
        );
      });
      
      if (matchedBranch) {
        response = matchedBranch.response;
      } else {
        // No match found - ask for clarification
        const optionsList = conversationFlow.branches
          .map((branch, index) => `${index + 1}. ${branch.title}`)
          .join('\n');
        
        response = `I'd be happy to help! Could you please clarify which option you're interested in?\n\n${optionsList}`;
      }
    }
    
    console.log('Sending response:', response);
    
    res.json({
      response: response,
      response_id: Date.now()
    });
    
  } catch (error) {
    console.error('Error in LLM webhook:', error);
    res.status(500).json({
      response: "I'm sorry, I'm having technical difficulties. Please try again.",
      response_id: Date.now()
    });
  }
});

// Create web call endpoint (updated to use custom LLM)
app.post('/create-web-call', async (req, res) => {
  try {
    console.log('Creating web call...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    let agentId = process.env.RETELL_AGENT_ID; // Default agent ID
    
    // Check if we have dynamic flow data
    if (req.body.flowData && req.body.flowData.conversationFlow) {
      console.log('Dynamic flow data detected, creating custom agent...');
      
      // Create custom agent with webhook
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
            type: "custom_llm",
            custom_llm_url: `${process.env.WEBHOOK_BASE_URL || 'https://retell-flow-backend.vercel.app'}/llm-webhook`
          },
          begin_message: req.body.flowData.conversationFlow.welcomeMessage,
          ambient_sound_enabled: false,
          backchanneling_enabled: true,
          interruption_sensitivity: 1,
          language: "en-US",
          responsiveness: 1,
          speed: 1,
        })
      });

      if (agentResponse.ok) {
        const agent = await agentResponse.json();
        agentId = agent.agent_id;
        console.log('Created custom agent:', agentId);
      } else {
        console.error('Failed to create custom agent, using default');
      }
    }
    
    // Create web call
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
    
    // Store the flow data for this call ID
    if (req.body.flowData) {
      conversationFlows.set(webCallResponse.call_id, req.body.flowData);
      console.log('Stored flow data for call:', webCallResponse.call_id);
    }
    
    console.log('Web call created successfully:', webCallResponse.call_id);
    
    res.json({
      success: true,
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id,
      agent_id: webCallResponse.agent_id,
      flow_type: req.body.flowData ? 'dynamic' : 'default',
      webhook_url: req.body.flowData ? `${process.env.WEBHOOK_BASE_URL || 'https://retell-flow-backend.vercel.app'}/llm-webhook` : null,
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
