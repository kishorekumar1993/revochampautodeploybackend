const express = require('express');
const axios = require('axios');
const router = express.Router();
const { setVercelToken } = require('../utils/tokenStore');

router.get('/connect', (req, res) => {
  const url = `https://vercel.com/integrations/oauth/authorize?client_id=${process.env.VERCEL_CLIENT_ID}&scope=read:user deployment:write project:write`;
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const sessionId = req.session.id;
  try {
    const tokenRes = await axios.post('https://api.vercel.com/v2/oauth/access_token', {
      client_id: process.env.VERCEL_CLIENT_ID,
      client_secret: process.env.VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: process.env.VERCEL_REDIRECT_URI,
    });
    const vercelToken = tokenRes.data.access_token;
    setVercelToken(sessionId, vercelToken);
    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Vercel OAuth failed');
  }
});

module.exports = router;