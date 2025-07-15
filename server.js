const express = require('express');
const path = require('path');
const app = express();

// Security and compression middleware
const helmet = require('helmet');
const compression = require('compression');

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());

// Serve static files from the public directory
app.use(express.static('public'));

// For all other routes, send the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});