// Authentication middleware
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user; // Attach user to request object
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = user; // Attach user to request object
      }
    }
    
    next(); // Always proceed, even if no token or invalid token
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Require admin privileges
const requireAdmin = async (req, res, next) => {
  // At this point, verifyToken should have already run and populated req.user
  // If verifyToken failed (e.g., invalid token), it would have already sent a response
  // and not called next(). So, if we reach here, req.user should be populated.

  // We still need a check for req.user in case verifyToken was optional or some other flow
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required (user not found after token verification)' });
  }

  // Check if user has admin role
  const { data: userData, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (error || !userData || userData.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  next(); // User is admin, proceed
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user.id : '');
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(time => now - time < windowMs);
    attempts.set(key, validAttempts);
    
    if (validAttempts.length >= maxAttempts) {
      return res.status(429).json({ 
        error: 'Too many attempts. Please try again later.' 
      });
    }
    
    validAttempts.push(now);
    next();
  };
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireAdmin,
  sensitiveOperationLimit
};