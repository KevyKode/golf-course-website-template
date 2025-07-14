// Global error handling middleware
const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.Console()
  ]
});

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleDatabaseError = (error) => {
  if (error.code === '23505') { // Unique constraint violation
    return new AppError('Duplicate entry. This record already exists.', 409);
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    return new AppError('Referenced record does not exist.', 400);
  }
  
  if (error.code === '23502') { // Not null constraint violation
    return new AppError('Required field is missing.', 400);
  }
  
  return new AppError('Database operation failed.', 500);
};

const handleValidationError = (error) => {
  const errors = error.errors?.map(err => err.message) || [error.message];
  return new AppError(`Validation error: ${errors.join(', ')}`, 400);
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};

const handleStripeError = (error) => {
  switch (error.type) {
    case 'StripeCardError':
      return new AppError(`Payment failed: ${error.message}`, 400);
    case 'StripeRateLimitError':
      return new AppError('Too many requests made to the API too quickly.', 429);
    case 'StripeInvalidRequestError':
      return new AppError('Invalid parameters were supplied to Stripe.', 400);
    case 'StripeAPIError':
      return new AppError('An error occurred internally with Stripe.', 500);
    case 'StripeConnectionError':
      return new AppError('Network communication with Stripe failed.', 500);
    case 'StripeAuthenticationError':
      return new AppError('Authentication with Stripe failed.', 500);
    default:
      return new AppError('Payment processing error.', 500);
  }
};

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific error types
    if (error.code?.startsWith('23')) error = handleDatabaseError(error);
    if (error.name === 'ValidationError') error = handleValidationError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.type?.startsWith('Stripe')) error = handleStripeError(error);
    
    sendErrorProd(error, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = {
  AppError,
  errorHandler,
  catchAsync
};