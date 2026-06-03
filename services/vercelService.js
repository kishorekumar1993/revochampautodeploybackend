const axios = require('axios');

/**
 * Creates or retrieves a Vercel project and links it to a GitHub repository.
 * Configures specific framework properties (especially for Flutter, React, Next.js).
 */
async function createProject(vercelToken, repoFullName, repoName, framework) {
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  const settings = {
    name,
    gitRepository: {
      type: 'github',
      repo: repoFullName
    }
  };

  // Configure framework presets and build commands
  if (framework === 'flutter') {
    settings.framework = null; // No native Flutter preset, we configure custom build commands
    settings.buildCommand = 'bash vercel-build.sh';
    settings.outputDirectory = 'build/web';
    settings.installCommand = ''; // Handled by vercel-build.sh during the build phase
  } else if (framework === 'nextjs') {
    settings.framework = 'nextjs';
  } else if (framework === 'react' || framework === 'vite') {
    settings.framework = 'vite';
    settings.buildCommand = 'npm run build';
    settings.outputDirectory = 'dist';
    settings.installCommand = 'npm install';
  }

  try {
    const response = await axios.post('https://api.vercel.com/v11/projects', settings, {
      headers: { Authorization: `Bearer ${vercelToken}` }
    });
    return response.data;
  } catch (error) {
    // If the project already exists or name is taken, retrieve the existing project details.
    if (error.response && (error.response.status === 409 || error.response.status === 400)) {
      try {
        const getResponse = await axios.get(`https://api.vercel.com/v9/projects/${name}`, {
          headers: { Authorization: `Bearer ${vercelToken}` }
        });
        return getResponse.data;
      } catch (getErr) {
        console.error('Vercel project creation POST failed:', error.response?.data || error.message);
        console.error('Failed to get existing Vercel project:', getErr.response?.data || getErr.message);
        
        // If the GET request fails with 404 (Not Found), the project doesn't exist,
        // so the original POST error is the true cause of failure.
        if (getErr.response && getErr.response.status === 404) {
          throw error;
        }
        throw getErr;
      }
    }
    console.error('Vercel project creation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Triggers a deployment for the linked GitHub repository on Vercel.
 */
async function createDeployment(vercelToken, repoFullName, repoId, repoName, framework, defaultBranch = 'main') {
  // First ensure project is created and linked
  await createProject(vercelToken, repoFullName, repoName, framework);

  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  try {
    const response = await axios.post('https://api.vercel.com/v13/deployments', {
      name,
      gitSource: {
        type: 'github',
        repoId: String(repoId),
        ref: defaultBranch
      }
    }, {
      headers: { Authorization: `Bearer ${vercelToken}` }
    });
    return response.data;
  } catch (error) {
    console.error('Vercel deployment trigger failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Retrieves the deployment status of a Vercel deployment by ID.
 */
async function getDeploymentStatus(vercelToken, deploymentId) {
  try {
    const response = await axios.get(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${vercelToken}` }
    });
    return response.data.status;
  } catch (error) {
    console.error(`Failed to get status for deployment ${deploymentId}:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = { createDeployment, getDeploymentStatus };
