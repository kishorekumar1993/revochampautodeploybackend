const express = require('express');
const axios = require('axios');
const router = express.Router();
const { setVercelToken } = require('../utils/tokenStore');

router.get('/connect', async (req, res) => {
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

  // Fallback if Vercel Personal Access Token is configured in .env
  if (process.env.VERCEL_TOKEN && 
      process.env.VERCEL_TOKEN !== 'your_vercel_token_here' && 
      !process.env.VERCEL_TOKEN.startsWith('your_')) {
    try {
      const vercelToken = process.env.VERCEL_TOKEN;
      await setVercelToken(req.session, vercelToken);
      
      const { getOrCreateUserId } = require('../utils/tokenStore');
      const userId = await getOrCreateUserId(req.session);
      
      const redirectUrl = (req.session.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      return res.redirect(`${redirectUrl}?vercelToken=${encodeURIComponent(vercelToken)}&userId=${encodeURIComponent(userId)}`);
    } catch (error) {
      console.error('Failed to set personal Vercel token:', error);
      return res.status(500).send('Setting Vercel Token failed');
    }
  }

  // Otherwise, use OAuth flow
  if (!process.env.VERCEL_CLIENT_ID) {
    return res.status(400).send('VERCEL_CLIENT_ID is not configured in backend .env. Please configure VERCEL_TOKEN for Personal Token fallback or VERCEL_CLIENT_ID for OAuth.');
  }

  const url = `https://vercel.com/integrations/oauth/authorize?client_id=${process.env.VERCEL_CLIENT_ID}&scope=read:user deployment:write project:write`;
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokenRes = await axios.post('https://api.vercel.com/v2/oauth/access_token', {
      client_id: process.env.VERCEL_CLIENT_ID,
      client_secret: process.env.VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: process.env.VERCEL_REDIRECT_URI,
    });
    const vercelToken = tokenRes.data.access_token;
    await setVercelToken(req.session, vercelToken);
    
    const { getOrCreateUserId } = require('../utils/tokenStore');
    const userId = await getOrCreateUserId(req.session);
    
    const redirectUrl = (req.session.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(`${redirectUrl}?vercelToken=${encodeURIComponent(vercelToken)}&userId=${encodeURIComponent(userId)}`);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Vercel OAuth failed');
  }
});

module.exports = router;