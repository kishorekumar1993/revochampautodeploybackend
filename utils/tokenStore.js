// Simple in-memory store (one user per session)
const userTokens = {}; // { userId: { githubToken, vercelToken, githubUsername, vercelUserId } }
let nextUserId = 1;

function getOrCreateUserId(sessionId) {
  if (!userTokens[sessionId]) {
    userTokens[sessionId] = { userId: nextUserId++ };
  }
  return userTokens[sessionId].userId;
}

function setGitHubToken(sessionId, token, username) {
  if (!userTokens[sessionId]) userTokens[sessionId] = {};
  userTokens[sessionId].githubToken = token;
  userTokens[sessionId].githubUsername = username;
}

function setVercelToken(sessionId, token) {
  if (!userTokens[sessionId]) userTokens[sessionId] = {};
  userTokens[sessionId].vercelToken = token;
}

function getTokens(sessionId) {
  return userTokens[sessionId] || {};
}

module.exports = { getOrCreateUserId, setGitHubToken, setVercelToken, getTokens };