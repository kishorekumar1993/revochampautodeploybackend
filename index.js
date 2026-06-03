require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieSession = require('cookie-session');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // dynamic frontend URL
  credentials: true
}));
app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax'
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