require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
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

// 1. GitHub Fork Verification
async function verifyFork(username) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${username}/Arslan_MD`, {
      headers: {
        'User-Agent': 'ARSLAN-MD-Deployer',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return response.data.fork && 
           response.data.parent &&
           response.data.parent.full_name === 'Arslan-MD/Arslan_MD';
  } catch (error) {
    console.error('Fork check failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// 2. Session ID Validation
function isValidSession(session_id) {
  const prefixValid = session_id.startsWith("(ARSLAN-MD~)") || 
                     session_id.startsWith("ARSLAN-MD~");
  
  if (!prefixValid) return false;

  try {
    const base64Part = session_id.replace(/^(\(ARSLAN-MD~\)|ARSLAN-MD~)/, '');
    return Buffer.from(base64Part, 'base64').length > 10;
  } catch {
    return false;
  }
}

// 3. Main Deploy Endpoint
app.post('/deploy', async (req, res) => {
  const { github_username, session_id } = req.body;

  // Step 1: Verify Fork
  const isForked = await verifyFork(github_username);
  if (!isForked) {
    return res.status(400).json({
      error: "Please fork the official ARSLAN-MD repo first!",
      fork_url: "https://github.com/Arslan-MD/Arslan_MD/fork"
    });
  }

  // Step 2: Validate Session
  if (!isValidSession(session_id)) {
    return res.status(400).json({
      error: "Invalid SESSION_ID! Format: (ARSLAN-MD~)base64"
    });
  }

  // Step 3: Deploy to Heroku
  try {
    const APP_NAME = `arslan-botz-${Date.now()}`;
    
    // Create App
    await axios.post(`${HEROKU_API.baseURL}/apps`, {
      name: APP_NAME,
      region: 'eu'
    }, { headers: HEROKU_API.headers });

    // Set Config
    await axios.patch(`${HEROKU_API.baseURL}/apps/${APP_NAME}/config-vars`, {
      SESSION_ID: session_id,
      GITHUB_USERNAME: github_username
    }, { headers: HEROKU_API.headers });

    // Trigger Build
    await axios.post(`${HEROKU_API.baseURL}/apps/${APP_NAME}/builds`, {
      source_blob: {
        url: 'https://github.com/Arslan-MD/Arslan-Botz/tarball/main'
      }
    }, { headers: HEROKU_API.headers });

    res.json({ 
      success: true,
      url: `https://${APP_NAME}.herokuapp.com`,
      appName: APP_NAME
    });

  } catch (error) {
    console.error('Deploy Error:', error.response?.data || error.message);
    res.status(500).json({
      error: "Deployment failed",
      details: error.response?.data || error.message
    });
  }
});

// 4. Auto-Cleanup (24h)
setInterval(async () => {
  try {
    const { data: apps } = await axios.get(`${HEROKU_API.baseURL}/apps`, {
      headers: HEROKU_API.headers
    });

    for (const app of apps) {
      if (app.name.startsWith('arslan-botz-')) {
        const created = new Date(app.created_at);
        const hours = (Date.now() - created) / (1000 * 60 * 60);
        
        if (hours >= 24) {
          await axios.delete(`${HEROKU_API.baseURL}/apps/${app.name}`, {
            headers: HEROKU_API.headers
          });
          console.log(`♻️ Deleted old app: ${app.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup Error:', error.message);
  }
}, 6 * 60 * 60 * 1000); // Run every 6 hours

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  █████╗ ██████╗ ███████╗██╗      ███╗   ██╗
  ██╔══██╗██╔══██╗██╔════╝██║      ████╗  ██║
  ███████║██████╔╝█████╗  ██║█████╗██╔██╗ ██║
  ██╔══██║██╔══██╗██╔══╝  ██║╚════╝██║╚██╗██║
  ██║  ██║██║  ██║███████╗███████╗ ██║ ╚████║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═╝  ╚═══╝
  
  🚀 Server ready: http://localhost:${PORT}
  `);
});
