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

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://maps.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://*.supabase.co"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"]
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Compression
app.use(compression());

// =============================================================================
// BODY PARSING MIDDLEWARE
// =============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// SESSION CONFIGURATION
// =============================================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// =============================================================================
// PASSPORT INITIALIZATION
// =============================================================================
app.use(passport.initialize());
app.use(passport.session());

// =============================================================================
// LOGGING MIDDLEWARE
// =============================================================================
if (process.env.NODE_ENV === 'production') {
  app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: false,
  }));
} else {
  app.use(morgan('dev'));
}

// =============================================================================
// STATIC FILES
// =============================================================================
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/images', express.static(path.join(__dirname, 'assets/images')));

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
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', authMiddleware.verifyToken, authMiddleware.requireAdmin, adminRoutes);

// =============================================================================
// MAIN WEBSITE ROUTES
// =============================================================================

// Serve main website
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin dashboard (if implemented)
app.get('/admin', authMiddleware.requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/index.html'));
});

// Catch-all route for SPA (if using client-side routing)
app.get('*', (req, res) => {
  // Check if it's an API route that doesn't exist
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // For all other routes, serve the main page (SPA behavior)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use(errorHandler);

// Express error logging
if (process.env.NODE_ENV === 'production') {
  app.use(expressWinston.errorLogger({
    winstonInstance: logger
  }));
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

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