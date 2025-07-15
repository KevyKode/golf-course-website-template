const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP if it causes issues with your resources
}));

// Compress responses
app.use(compression());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Custom routes can go here
// app.get('/api/example', (req, res) => { ... });

// For all other routes, send the index.html file (for single-page applications)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});