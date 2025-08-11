const express = require('express');
const { execSync } = require('child_process');
require('dotenv').config();

const app = express();
app.use(express.json());

// Validate SESSION_ID
function isValidSession(session_id) {
  return session_id.startsWith("(ARSLAN-MD~)") && 
         Buffer.from(session_id.replace("(ARSLAN-MD~)", ""), 'base64').length > 10;
}

// Deploy Endpoint
app.post('/deploy', (req, res) => {
  const { github_username, session_id } = req.body;

  // 1. Validate Session
  if (!isValidSession(session_id)) {
    return res.status(400).json({ error: "Invalid SESSION_ID! Format: (ARSLAN-MD~)base64" });
  }

  // 2. Create Heroku App
  try {
    const APP_NAME = `arslan-botz-${Date.now()}`;
    
    execSync(`heroku create ${APP_NAME} --region eu`);
    execSync(`heroku config:set SESSION_ID="${session_id}" --app ${APP_NAME}`);
    execSync(`git clone https://github.com/Arslan-MD/Arslan-Botz.git ${APP_NAME}`);
    execSync(`cd ${APP_NAME} && git push https://heroku:${process.env.HEROKU_API_KEY}@git.heroku.com/${APP_NAME}.git HEAD:master`);

    res.json({ success: true, url: `https://${APP_NAME}.herokuapp.com` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
