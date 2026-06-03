const axios = require('axios');

// ---------- Helpers ----------

/**
 * Sanitize a repository name to a valid Vercel project name.
 * Rules: lowercase, alphanumerics and hyphens only, no consecutive/leading/trailing hyphens, max 100 chars.
 */
function sanitizeProjectName(repoName) {
  let name = repoName.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')   // replace invalid chars with hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')       // trim leading/trailing hyphens
    .slice(0, 100);                // enforce max length

  // If the result is empty after sanitization, provide a fallback
  return name || 'vercel-project';
}

/**
 * Return the framework-specific settings for Vercel project/deployment.
 * Centralised to avoid duplication.
 */
function getFrameworkSettings(framework) {
  switch (framework) {
    case 'flutter':
      return {
        framework: 'other',
        buildCommand: 'bash vercel-build.sh',
        outputDirectory: 'build/web',
        installCommand: ''
      };
    case 'nextjs':
      return { framework: 'nextjs' };
    case 'react':
    case 'vite':
      return {
        framework: 'vite',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        installCommand: 'npm install'
      };
    default:
      return {};
  }
}

/**
 * Creates an axios instance pre-configured for the Vercel API.
 */
function createVercelClient(vercelToken) {
  return axios.create({
    baseURL: 'https://api.vercel.com',
    headers: { Authorization: `Bearer ${vercelToken}` }
  });
}

// ---------- Core Functions ----------

/**
 * Creates or retrieves a Vercel project and ensures it is linked to a GitHub repository.
 * If the project already exists but isn’t linked, it updates the linkage.
 */
async function createProject(vercelToken, repoFullName, repoName, framework) {
  // Input validation
  if (!vercelToken || !repoFullName || !repoName) {
    throw new Error('Missing required parameters: vercelToken, repoFullName, repoName');
  }

  const client = createVercelClient(vercelToken);
  const name = sanitizeProjectName(repoName);
  const frameworkSettings = getFrameworkSettings(framework);

  const payload = {
    name,
    gitRepository: {
      type: 'github',
      repo: repoFullName
    },
    ...frameworkSettings
  };

  try {
    const response = await client.post('/v11/projects', payload);
    return response.data;
  } catch (error) {
    // Only handle conflict (project name already taken) by retrieving the existing project.
    // Other 4xx errors (e.g., invalid parameters) should be thrown immediately.
    if (error.response?.status === 409) {
      try {
        // Fetch existing project (using consistent API version)
        const existing = await client.get(`/v11/projects/${name}`);
        const project = existing.data;

        // If the project isn't linked to the GitHub repo, update it now
        if (!project.link || project.link.type !== 'github' || project.link.repo !== repoFullName) {
          await client.patch(`/v11/projects/${project.id}`, {
            gitRepository: {
              type: 'github',
              repo: repoFullName
            }
          });
        }
        return project;
      } catch (getErr) {
        console.error('Vercel project creation POST failed:', error.response?.data || error.message);
        console.error('Failed to retrieve or update existing Vercel project:', getErr.response?.data || getErr.message);

        // If the GET fails with 404, the original POST error is the true cause
        if (getErr.response?.status === 404) {
          throw error;
        }
        throw getErr;
      }
    } else {
      // Any other error (e.g., 400 bad request) should not be treated as “project exists”
      console.error('Vercel project creation failed:', error.response?.data || error.message);
      throw error;
    }
  }
}

/**
 * Triggers a deployment for the linked GitHub repository on Vercel.
 */
async function createDeployment(vercelToken, repoFullName, repoId, repoName, framework, defaultBranch = 'main') {
  if (!vercelToken || !repoFullName || !repoId || !repoName) {
    throw new Error('Missing required parameters: vercelToken, repoFullName, repoId, repoName');
  }

  // First ensure the project exists and is linked
  const project = await createProject(vercelToken, repoFullName, repoName, framework);

  const client = createVercelClient(vercelToken);
  const name = sanitizeProjectName(repoName);

  const deploymentPayload = {
    name,
    project: project.id,
    gitSource: {
      type: 'github',
      repoId: String(repoId),
      ref: defaultBranch
    }
  };

  // Attach framework-specific settings (if any) directly in the deployment request
  const settings = getFrameworkSettings(framework);
  if (Object.keys(settings).length > 0) {
    deploymentPayload.projectSettings = settings;
  }

  try {
    const response = await client.post(
      '/v13/deployments?skipAutoDetectionConfirmation=1',
      deploymentPayload
    );
    return response.data;
  } catch (error) {
    console.error('Vercel deployment trigger failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Retrieves the full deployment object by ID. (Returns the entire data for maximum flexibility.)
 */
async function getDeploymentStatus(vercelToken, deploymentId) {
  if (!vercelToken || !deploymentId) {
    throw new Error('Missing required parameters: vercelToken, deploymentId');
  }

  const client = createVercelClient(vercelToken);
  try {
    const response = await client.get(`/v13/deployments/${deploymentId}`);
    return response.data;   // contains status, url, alias, etc.
  } catch (error) {
    console.error(`Failed to get deployment ${deploymentId}:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = { createDeployment, getDeploymentStatus };
