const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const app = express();

// Enable security headers but disable CSP for local development
app.use(helmet({
  contentSecurityPolicy: false
}));

// Compress responses
app.use(compression());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Determine where to serve static files from based on environment
// For development, we'll look in both the root directory and the public directory
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Log requests during development
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Custom routes can go here
// app.get('/api/example', (req, res) => { ... });

// For all other routes, send the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ┌───────────────────────────────────────────────┐
  │                                               │
  │   Development server running on port ${PORT}     │
  │                                               │
  │   Local:            http://localhost:${PORT}     │
  │                                               │
  └───────────────────────────────────────────────┘
  `);
});