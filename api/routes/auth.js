// Authentication routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth required')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register new user
router.post('/register', registerValidation, catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    email,
    password,
    first_name,
    last_name,
    phone,
    date_of_birth
  } = req.body;

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Register with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name,
        phone,
        date_of_birth
      }
    }
  });

  if (authError) {
    throw new AppError(authError.message, 400);
  }

  // Create user profile in our users table
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      first_name,
      last_name,
      phone,
      date_of_birth,
      is_verified: false
    })
    .select()
    .single();

  if (profileError) {
    // If profile creation fails, we should clean up the auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new AppError('Failed to create user profile', 500);
  }

  res.status(201).json({
    message: 'User registered successfully. Please check your email for verification.',
    user: {
      id: userProfile.id,
      email: userProfile.email,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      is_verified: userProfile.is_verified
    },
    session: authData.session
  });
}));

// Login user
router.post('/login', loginValidation, catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  // Sign in with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    throw new AppError('Invalid email or password', 401);
  }

  // Get user profile
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    throw new AppError('User profile not found', 404);
  }

  // Update last login
  await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', authData.user.id);

  res.json({
    message: 'Login successful',
    user: {
      id: userProfile.id,
      email: userProfile.email,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      phone: userProfile.phone,
      is_verified: userProfile.is_verified,
      role: userProfile.role
    },
    session: authData.session
  });
}));

// Logout user
router.post('/logout', verifyToken, catchAsync(async (req, res) => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw new AppError('Logout failed', 500);
  }

  res.json({ message: 'Logout successful' });
}));

// Get current user profile
router.get('/profile', verifyToken, catchAsync(async (req, res) => {
  const { data: userProfile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) {
    throw new AppError('User profile not found', 404);
  }

  res.json({
    user: {
      id: userProfile.id,
      email: userProfile.email,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      phone: userProfile.phone,
      date_of_birth: userProfile.date_of_birth,
      is_verified: userProfile.is_verified,
      email_notifications: userProfile.email_notifications,
      sms_notifications: userProfile.sms_notifications,
      marketing_emails: userProfile.marketing_emails,
      created_at: userProfile.created_at,
      last_login: userProfile.last_login
    }
  });
}));

// Update user profile
router.put('/profile', verifyToken, [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth required'),
  body('email_notifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be true or false'),
  body('sms_notifications')
    .optional()
    .isBoolean()
    .withMessage('SMS notifications must be true or false'),
  body('marketing_emails')
    .optional()
    .isBoolean()
    .withMessage('Marketing emails must be true or false')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updates = req.body;

  const { data: updatedProfile, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update profile', 500);
  }

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: updatedProfile.id,
      email: updatedProfile.email,
      first_name: updatedProfile.first_name,
      last_name: updatedProfile.last_name,
      phone: updatedProfile.phone,
      date_of_birth: updatedProfile.date_of_birth,
      is_verified: updatedProfile.is_verified,
      email_notifications: updatedProfile.email_notifications,
      sms_notifications: updatedProfile.sms_notifications,
      marketing_emails: updatedProfile.marketing_emails
    }
  });
}));

// Change password
router.put('/change-password', verifyToken, [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { current_password, new_password } = req.body;

  // Update password with Supabase Auth
  const { data, error } = await supabase.auth.updateUser({
    password: new_password
  });

  if (error) {
    throw new AppError('Failed to change password', 400);
  }

  res.json({ message: 'Password changed successfully' });
}));

// Request password reset
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.PRODUCTION_URL || 'http://localhost:3000'}/reset-password`
  });

  if (error) {
    throw new AppError('Failed to send password reset email', 500);
  }

  res.json({
    message: 'Password reset email sent. Please check your inbox.'
  });
}));

// Reset password
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token, new_password } = req.body;

  // Verify and use the reset token
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery'
  });

  if (error) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: new_password
  });

  if (updateError) {
    throw new AppError('Failed to reset password', 500);
  }

  res.json({ message: 'Password reset successfully' });
}));

// Verify email
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token } = req.body;

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'signup'
  });

  if (error) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  // Update user verification status
  await supabase
    .from('users')
    .update({ is_verified: true })
    .eq('id', data.user.id);

  res.json({ message: 'Email verified successfully' });
}));

// Resend verification email
router.post('/resend-verification', verifyToken, catchAsync(async (req, res) => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: req.user.email
  });

  if (error) {
    throw new AppError('Failed to resend verification email', 500);
  }

  res.json({ message: 'Verification email sent' });
}));

// Google OAuth callback (if using Google OAuth)
router.get('/google/callback', catchAsync(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    throw new AppError('Authorization code is required', 400);
  }

  // Exchange code for session with Supabase
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw new AppError('Failed to authenticate with Google', 400);
  }

  // Check if user profile exists, create if not
  const { data: existingProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!existingProfile) {
    // Create user profile for OAuth user
    await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: data.user.email,
        first_name: data.user.user_metadata.first_name || '',
        last_name: data.user.user_metadata.last_name || '',
        google_id: data.user.user_metadata.sub,
        is_verified: true
      });
  }

  // Redirect to frontend with session
  res.redirect(`${process.env.PRODUCTION_URL || 'http://localhost:3000'}?session=${data.session.access_token}`);
}));

// Refresh token
router.post('/refresh', catchAsync(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw new AppError('Refresh token is required', 400);
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token
  });

  if (error) {
    throw new AppError('Failed to refresh session', 401);
  }

  res.json({
    message: 'Session refreshed successfully',
    session: data.session
  });
}));

module.exports = router;