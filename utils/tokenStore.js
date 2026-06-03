// Simple helper functions to get/set tokens inside cookie session

function getOrCreateUserId(session) {
  if (!session.userId) {
    session.userId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  return session.userId;
}

function setGitHubToken(session, token, username) {
  session.githubToken = token;
  session.githubUsername = username;
}

function setVercelToken(session, token) {
  session.vercelToken = token;
}

function getTokens(session) {
  return {
    githubToken: session ? session.githubToken : null,
    githubUsername: session ? session.githubUsername : null,
    vercelToken: session ? session.vercelToken : null
  };
}

module.exports = { getOrCreateUserId, setGitHubToken, setVercelToken, getTokens };