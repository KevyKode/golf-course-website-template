// Rooks County Golf Course - Main Server File
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const winston = require('winston');
const expressWinston = require('express-winston');

// Import route handlers
const authRoutes = require('./api/routes/auth');
const bookingRoutes = require('./api/routes/bookings');
const membershipRoutes = require('./api/routes/memberships');
const eventRoutes = require('./api/routes/events');
const contactRoutes = require('./api/routes/contact');
const adminRoutes = require('./api/routes/admin');
const paymentRoutes = require('./api/routes/payments');

// Import middleware
const authMiddleware = require('./api/middleware/auth');
const { errorHandler } = require('./api/middleware/errorHandler');

// Import database connection
const { supabase } = require('./api/config/database');

// Import passport configuration
require('./api/config/passport');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rooks-county-golf' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================
// Modified helmet configuration to allow loading CSS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);
app.use(cors());

// =============================================================================
// PERFORMANCE MIDDLEWARE
// =============================================================================
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// =============================================================================
// PARSING MIDDLEWARE
// =============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// SESSION CONFIGURATION
// =============================================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'golf-course-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// =============================================================================
// STATIC FILES - MODIFIED FOR RAILWAY COMPATIBILITY
// =============================================================================
// Main assets directory
app.use(express.static(path.join(__dirname, 'assets')));

// Specific asset directories with explicit paths
app.use('/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/images', express.static(path.join(__dirname, 'assets/images')));

// Additional fallback for potential dist directory
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key')
      .limit(1);
    
    if (error) throw error;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// =============================================================================
// API ROUTES
// =============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', authMiddleware.requireAuth, adminRoutes);
app.use('/api/payments', paymentRoutes);

// =============================================================================
// SERVE FRONTEND (for SPA or static site)
// =============================================================================
// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'index.html'));
});

// =============================================================================
// ERROR HANDLING
// =============================================================================
app.use(errorHandler);

// =============================================================================
// START SERVER
// =============================================================================
const server = app.listen(PORT, () => {
  logger.info(`🏌️ Rooks County Golf Course server running on port ${PORT}`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📍 Server URL: http://localhost:${PORT}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`
    🏌️‍♂️ Rooks County Golf Course Website
    =====================================
    🌐 Website: http://localhost:${PORT}
    📊 Health Check: http://localhost:${PORT}/health
    🔧 API Base: http://localhost:${PORT}/api
    
    📚 Available API Endpoints:
    - POST /api/auth/register
    - POST /api/auth/login
    - GET  /api/bookings
    - POST /api/bookings
    - GET  /api/events
    - POST /api/contact
    - GET  /api/memberships
    
    🚀 Ready for development!
    `);
  }
});

// Handle server startup errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('Server startup error:', error);
    process.exit(1);
  }
});

module.exports = app;