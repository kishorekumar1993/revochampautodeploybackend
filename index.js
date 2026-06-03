require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieSession = require('cookie-session');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin (with any port)
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    
    // Allow the configured FRONTEND_URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    if (!isProduction) {
      return callback(null, true);
    }
    
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'fallback-secret-key'],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction
}));

// Routes
const githubRoutes = require('./routes/github');
const vercelRoutes = require('./routes/vercel');
const projectRoutes = require('./routes/project');

app.use('/github', githubRoutes);
app.use('/vercel', vercelRoutes);
app.use('/project', projectRoutes);

app.get('/', (req, res) => {
  res.send('Revochamp Backend Running');
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;