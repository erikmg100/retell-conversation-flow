import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS like your working version
app.use(cors({
  origin: [
    'https://retell-conversation-flow.vercel.app',
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

// Create web call endpoint - matching your working version
app.post('/create-web-call', async (req, res) => {
  try {
    console.log('Creating web call...');
    
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: process.env.RETELL_AGENT_ID, // Use your actual agent ID
        ...req.body
      })
    });

    if (!response.ok) {
      throw new Error(`Retell API error: ${response.status} ${response.statusText}`);
    }

    const webCallResponse = await response.json();
    
    console.log('Web call created successfully:', webCallResponse.call_id);
    
    // Return the access token exactly like your working version
    res.json({
      success: true,
      access_token: webCallResponse.access_token,  // Note: access_token not accessToken
      call_id: webCallResponse.call_id,
      agent_id: webCallResponse.agent_id
    });

  } catch (error) {
    console.error('Error creating web call:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create web call'
    });
  }
});

app.options('*', cors());

// For Vercel
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
