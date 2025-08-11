require('dotenv').config();
const express = require('express');
const { execSync } = require('child_process');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Validation
function isValidSession(session_id) {
  if (!session_id.startsWith("ARSLAN-MD~")) return false;
  const base64Part = session_id.replace("ARSLAN-MD~", "");
  try {
    return Buffer.from(base64Part, 'base64').length > 10;
  } catch {
    return false;
  }
}

// API Routes
app.post('/deploy', async (req, res) => {
  const { github_username, session_id } = req.body;

  try {
    // 1. Verify GitHub Fork
    const forkCheck = JSON.parse(execSync(`curl -s https://api.github.com/repos/${github_username}/Arslan_MD`).toString());
    if (!forkCheck.fork) {
      return res.status(400).json({ error: "Please fork the ARSLAN-MD repo first" });
    }

    // 2. Validate Session
    if (!isValidSession(session_id)) {
      return res.status(400).json({ error: "Invalid SESSION_ID format" });
    }

    // 3. Deploy to Heroku
    const APP_NAME = `arslan-botz-${Date.now()}`;
    
    execSync(`heroku create ${APP_NAME} --region eu`);
    execSync(`heroku config:set SESSION_ID="${session_id}" --app ${APP_NAME}`);
    
    execSync(`git clone https://github.com/Arslan-MD/Arslan-Botz.git ${APP_NAME}`);
    execSync(`cd ${APP_NAME} && git push https://heroku:${process.env.HEROKU_API_KEY}@git.heroku.com/${APP_NAME}.git HEAD:master`);

    // Cleanup
    execSync(`rm -rf ${APP_NAME}`);

    return res.json({ 
      success: true,
      url: `https://${APP_NAME}.herokuapp.com`,
      session: session_id.substring(0, 15) + '...' // Truncated for security
    });

  } catch (error) {
    console.error('Deployment Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Heroku API Key: ${process.env.HEROKU_API_KEY ? '✅ Configured' : '❌ Missing'}`);
});
