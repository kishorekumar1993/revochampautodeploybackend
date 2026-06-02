const express = require('express');
const router = express.Router();
const { getTokens } = require('../utils/tokenStore');
const { createRepo, pushWebsite } = require('../services/githubService');
const { createDeployment } = require('../services/vercelService');

// POST /project/create-and-deploy
router.post('/create-and-deploy', async (req, res) => {
  const sessionId = req.session.id;
  const { repoName, websiteHtml } = req.body;
  const tokens = getTokens(sessionId);
  
  if (!tokens.githubToken) {
    return res.status(401).json({ error: 'GitHub not connected' });
  }
  if (!tokens.vercelToken) {
    return res.status(401).json({ error: 'Vercel not connected' });
  }

  try {
    // 1. Create GitHub repo
    const repo = await createRepo(tokens.githubToken, repoName);
    const repoFullName = repo.full_name; // e.g., "username/mysite"

    // 2. Push website code
    await pushWebsite(tokens.githubToken, repoFullName, websiteHtml);

    // 3. Trigger Vercel deployment
    const deployment = await createDeployment(tokens.vercelToken, repoFullName);

    res.json({
      repoUrl: repo.html_url,
      deploymentUrl: `https://${deployment.url}`,
      deploymentId: deployment.id
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

// GET /deployment/status/:deploymentId
router.get('/deployment/status/:deploymentId', async (req, res) => {
  const sessionId = req.session.id;
  const { deploymentId } = req.params;
  const tokens = getTokens(sessionId);
  if (!tokens.vercelToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { getDeploymentStatus } = require('../services/vercelService');
  const status = await getDeploymentStatus(tokens.vercelToken, deploymentId);
  res.json({ status });
});

module.exports = router;