const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const tokenFilePath = process.env.VERCEL
  ? '/tmp/tokens.json'
  : path.join(__dirname, '../tokens.json');

// Mongoose schema (if MONGODB_URI is provided)
let UserToken;
let isConnected = false;

async function initDb() {
  if (process.env.MONGODB_URI) {
    if (!isConnected) {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        
        const UserTokenSchema = new mongoose.Schema({
          userId: { type: String, required: true, unique: true },
          githubToken: String,
          githubUsername: String,
          vercelToken: String,
          updatedAt: { type: Date, default: Date.now }
        });
        UserToken = mongoose.models.UserToken || mongoose.model('UserToken', UserTokenSchema);
      } catch (err) {
        console.error('Failed to connect to MongoDB, falling back to JSON file:', err);
      }
    }
  }
}

// Helper to read from local file
function readLocalTokens() {
  try {
    if (fs.existsSync(tokenFilePath)) {
      return JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read local tokens file:', err);
  }
  return {};
}

// Helper to write to local file
function writeLocalTokens(tokens) {
  try {
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local tokens file:', err);
  }
}

async function getOrCreateUserId(session) {
  if (!session) return 'default_user';
  if (!session.userId) {
    session.userId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  return session.userId;
}

async function setGitHubToken(session, token, username) {
  if (session) {
    session.githubToken = token;
    session.githubUsername = username;
  }
  
  const userId = await getOrCreateUserId(session);
  await initDb();
  
  if (isConnected && UserToken) {
    await UserToken.findOneAndUpdate(
      { userId },
      { githubToken: token, githubUsername: username, updatedAt: new Date() },
      { upsert: true }
    );
  } else {
    const data = readLocalTokens();
    if (!data[userId]) data[userId] = {};
    data[userId].githubToken = token;
    data[userId].githubUsername = username;
    writeLocalTokens(data);
  }
}

async function setVercelToken(session, token) {
  if (session) {
    session.vercelToken = token;
  }
  
  const userId = await getOrCreateUserId(session);
  await initDb();
  
  if (isConnected && UserToken) {
    await UserToken.findOneAndUpdate(
      { userId },
      { vercelToken: token, updatedAt: new Date() },
      { upsert: true }
    );
  } else {
    const data = readLocalTokens();
    if (!data[userId]) data[userId] = {};
    data[userId].vercelToken = token;
    writeLocalTokens(data);
  }
}

async function getTokens(session) {
  if (!session) {
    return { githubToken: null, githubUsername: null, vercelToken: null };
  }
  
  const userId = await getOrCreateUserId(session);
  await initDb();
  
  let dbTokens = null;
  if (isConnected && UserToken) {
    try {
      dbTokens = await UserToken.findOne({ userId });
    } catch (err) {
      console.error('Failed to query MongoDB for tokens:', err);
    }
  } else {
    const data = readLocalTokens();
    dbTokens = data[userId];
  }
  
  return {
    githubToken: dbTokens?.githubToken || session.githubToken || null,
    githubUsername: dbTokens?.githubUsername || session.githubUsername || null,
    vercelToken: dbTokens?.vercelToken || session.vercelToken || null
  };
}

module.exports = { getOrCreateUserId, setGitHubToken, setVercelToken, getTokens };