const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getTokens } = require('../utils/tokenStore');
const { createRepo, pushWebsite } = require('../services/githubService');
const { createDeployment } = require('../services/vercelService');

// POST /project/create-and-deploy
router.post('/create-and-deploy', async (req, res) => {
  const sessionId = req.session.id;
  const { repoName, websiteHtml, files, framework } = req.body;
  const tokens = getTokens(sessionId);
  
  if (!tokens.githubToken) {
    return res.status(401).json({ error: 'GitHub not connected' });
  }
  if (!tokens.vercelToken) {
    return res.status(401).json({ error: 'Vercel not connected' });
  }

  try {
    // 1. Create GitHub repo (or retrieve if already exists)
    let repo;
    try {
      repo = await createRepo(tokens.githubToken, repoName);
    } catch (error) {
      if (error.response && error.response.status === 422) {
        // Repository already exists, fetch it
        const username = tokens.githubUsername;
        const repoResponse = await axios.get(`https://api.github.com/repos/${username}/${repoName}`, {
          headers: { Authorization: `Bearer ${tokens.githubToken}` }
        });
        repo = repoResponse.data;
      } else {
        throw error;
      }
    }
    const repoFullName = repo.full_name; // e.g., "username/mysite"
    const repoId = repo.id;

    // 2. Prepare files to push
    let projectFiles = files;
    if (!projectFiles && websiteHtml) {
      projectFiles = [{ path: 'index.html', content: websiteHtml }];
    }

    if (!projectFiles || projectFiles.length === 0) {
      return res.status(400).json({ error: 'No files or HTML content provided' });
    }

    // Auto-inject vercel.json rewrite for SPA routing on Flutter/React
    if (framework === 'flutter' || framework === 'react') {
      const hasVercelJson = projectFiles.some(f => f.path.toLowerCase() === 'vercel.json');
      if (!hasVercelJson) {
        projectFiles.push({
          path: 'vercel.json',
          content: JSON.stringify({
            rewrites: [
              {
                source: '/(.*)',
                destination: '/index.html'
              }
            ]
          }, null, 2)
        });
      }
    }

    // Push website code
    await pushWebsite(tokens.githubToken, repoFullName, projectFiles);

    // 3. Trigger Vercel deployment
    const deployment = await createDeployment(tokens.vercelToken, repoFullName, repoId, repoName, framework);

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