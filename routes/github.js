const express = require('express');
const axios = require('axios');
const router = express.Router();
const { setGitHubToken } = require('../utils/tokenStore');

router.get('/connect', (req, res) => {
  const originQuery = req.query.origin;
  const referer = req.headers.referer;
  
  if (originQuery) {
    req.session.frontendUrl = originQuery;
  } else if (referer) {
    try {
      req.session.frontendUrl = new URL(referer).origin;
    } catch (e) {
      // Ignore invalid URL
    }
  }

  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`;
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, { headers: { Accept: 'application/json' } });

    const githubToken = tokenRes.data.access_token;
    // Get user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}` }
    });
    const username = userRes.data.login;
    setGitHubToken(req.session, githubToken, username);
    const redirectUrl = (req.session.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(`${redirectUrl}`); // frontend success URL
    // res.redirect(`${redirectUrl}/dashboard`); // frontend success URL
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('GitHub OAuth failed');
  }
});

module.exports = router;