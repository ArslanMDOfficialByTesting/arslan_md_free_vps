require('dotenv').config();
const express = require('express');
const axios = require('axios'); // For API calls
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Heroku API Config
const HEROKU_API = {
  baseURL: 'https://api.heroku.com',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.heroku+json; version=3',
    'Authorization': `Bearer ${process.env.HEROKU_API_KEY}`
  }
};

// Validate Session ID
function isValidSession(session_id) {
  return session_id.startsWith("(ARSLAN-MD~)") || 
         session_id.startsWith("ARSLAN-MD~");
}

// Deploy Endpoint
app.post('/deploy', async (req, res) => {
  const { github_username, session_id } = req.body;

  try {
    // 1. Validate Session
    if (!isValidSession(session_id)) {
      return res.status(400).json({ error: "Invalid SESSION_ID format" });
    }

    // 2. Create Heroku App
    const APP_NAME = `arslan-botz-${Date.now()}`;
    await axios.post(`${HEROKU_API.baseURL}/apps`, {
      name: APP_NAME,
      region: 'eu'
    }, { headers: HEROKU_API.headers });

    // 3. Set Config Vars
    await axios.patch(`${HEROKU_API.baseURL}/apps/${APP_NAME}/config-vars`, {
      SESSION_ID: session_id
    }, { headers: HEROKU_API.headers });

    // 4. Deploy from GitHub
    await axios.post(`${HEROKU_API.baseURL}/apps/${APP_NAME}/builds`, {
      source_blob: {
        url: 'https://github.com/Arslan-MD/Arslan-Botz/tarball/main'
      }
    }, { headers: HEROKU_API.headers });

    res.json({ 
      success: true,
      url: `https://${APP_NAME}.herokuapp.com`
    });

  } catch (error) {
    console.error('Deployment Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: "Deployment failed",
      details: error.response?.data || error.message
    });
  }
});

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
