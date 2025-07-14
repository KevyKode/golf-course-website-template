// Membership routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const moment = require('moment');

const router = express.Router();

// Get membership types and pricing
router.get('/types', catchAsync(async (req, res) => {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value, description')
    .like('setting_key', 'membership_%')
    .eq('is_public', true);

  const membershipTypes = [
    {
      type: 'single',
      name: 'Single Adult Membership',
      price: parseFloat(settings.find(s => s.setting_key === 'membership_single')?.setting_value || 250),
      description: 'Perfect for individual golfers who want unlimited access to the course',
      features: [
        'Unlimited golf all season',
        'Cart shed access available',
        'Member events and tournaments',
        'Priority tee time booking',
        'Guest privileges'
      ]
    },
    {
      type: 'family',
      name: 'Family Membership',
      price: parseFloat(settings.find(s => s.setting_key === 'membership_family')?.setting_value || 325),
      description: 'Great value for families who love golf together',
      features: [
        'Unlimited golf for family',
        'Cart shed access available',
        'Family tournament events',
        'Junior golf programs',
        'Best value for families'
      ]
    },
    {
      type: 'student',
      name: 'Student Membership (K-12)',
      price: parseFloat(settings.find(s => s.setting_key === 'membership_student')?.setting_value || 100),
      description: 'Special pricing for students K-12',
      features: [
        'K-12 students only',
        'Unlimited golf access',
        'Youth tournament eligibility',
        'Golf instruction opportunities',
        'Character building through golf'
      ]
    },
    {
      type: 'alumni',
      name: 'School Program Alumni',
      price: parseFloat(settings.find(s => s.setting_key === 'membership_alumni')?.setting_value || 50),
      description: 'Special rate for Rooks County Schools golf program alumni',
      features: [
        'Rooks County Schools golf alumni',
        'Special discounted rate',
        'Unlimited golf access',
        'Alumni tournament events',
        'Support local golf programs'
      ]
    }
  ];

  res.json({ membership_types: membershipTypes });
}));

// Get user's current membership
router.get('/my-membership', verifyToken, catchAsync(async (req, res) => {
  const { data: membership, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('status', 'active')
    .gte('end_date', moment().format('YYYY-MM-DD'))
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    throw new AppError('Failed to fetch membership', 500);
  }

  res.json({ membership: membership || null });
}));

// Apply for membership
router.post('/', verifyToken, [
  body('membership_type')
    .isIn(['single', 'family', 'student', 'alumni'])
    .withMessage('Invalid membership type'),
  body('family_members')
    .optional()
    .isArray()
    .withMessage('Family members must be an array'),
  body('graduation_year')
    .optional()
    .isInt({ min: 1950, max: new Date().getFullYear() + 10 })
    .withMessage('Valid graduation year required'),
  body('cart_shed_requested')
    .optional()
    .isBoolean()
    .withMessage('Cart shed request must be true or false')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    membership_type,
    family_members,
    graduation_year,
    cart_shed_requested
  } = req.body;

  // Check if user already has an active membership
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('status', 'active')
    .gte('end_date', moment().format('YYYY-MM-DD'))
    .single();

  if (existingMembership) {
    throw new AppError('You already have an active membership', 409);
  }

  // Get membership pricing
  const { data: pricingSetting } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', `membership_${membership_type}`)
    .single();

  const annualFee = parseFloat(pricingSetting?.setting_value || 0);

  if (annualFee === 0) {
    throw new AppError('Invalid membership type', 400);
  }

  // Validate family members for family membership
  if (membership_type === 'family' && (!family_members || family_members.length === 0)) {
    throw new AppError('Family members are required for family membership', 400);
  }

  // Validate graduation year for student/alumni memberships
  if ((membership_type === 'student' || membership_type === 'alumni') && !graduation_year) {
    throw new AppError('Graduation year is required for student/alumni membership', 400);
  }

  // Create membership
  const membershipData = {
    user_id: req.user.id,
    membership_type,
    annual_fee: annualFee,
    start_date: moment().format('YYYY-MM-DD'),
    end_date: moment().add(1, 'year').format('YYYY-MM-DD'),
    family_members: family_members || null,
    graduation_year,
    status: 'active', // In real implementation, this might be 'pending' until payment
    payment_method: 'pending'
  };

  // Handle student verification
  if (membership_type === 'student' || membership_type === 'alumni') {
    membershipData.school_verification = false; // Would need manual verification
  }

  const { data: membership, error } = await supabase
    .from('memberships')
    .insert(membershipData)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create membership', 500);
  }

  // TODO: Create Stripe subscription or payment intent
  // TODO: Send welcome email

  res.status(201).json({
    message: 'Membership application submitted successfully',
    membership,
    payment_required: annualFee > 0
  });
}));

// Update membership
router.put('/:id', verifyToken, [
  body('auto_renew')
    .optional()
    .isBoolean()
    .withMessage('Auto renew must be true or false'),
  body('family_members')
    .optional()
    .isArray()
    .withMessage('Family members must be an array'),
  body('cart_shed_requested')
    .optional()
    .isBoolean()
    .withMessage('Cart shed request must be true or false')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  // Get existing membership
  const { data: existingMembership, error: fetchError } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingMembership) {
    throw new AppError('Membership not found', 404);
  }

  // Check ownership
  if (existingMembership.user_id !== req.user.id) {
    throw new AppError('Not authorized to update this membership', 403);
  }

  const { data: updatedMembership, error } = await supabase
    .from('memberships')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update membership', 500);
  }

  res.json({
    message: 'Membership updated successfully',
    membership: updatedMembership
  });
}));

// Cancel membership
router.delete('/:id', verifyToken, [
  body('cancellation_reason')
    .optional()
    .isString()
    .withMessage('Cancellation reason must be a string')
], catchAsync(async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  // Get existing membership
  const { data: existingMembership, error: fetchError } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingMembership) {
    throw new AppError('Membership not found', 404);
  }

  // Check ownership
  if (existingMembership.user_id !== req.user.id) {
    throw new AppError('Not authorized to cancel this membership', 403);
  }

  // Update membership status
  const { data: cancelledMembership, error } = await supabase
    .from('memberships')
    .update({
      status: 'cancelled',
      auto_renew: false,
      // Store cancellation reason in a metadata field if needed
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to cancel membership', 500);
  }

  // TODO: Cancel Stripe subscription
  // TODO: Send cancellation confirmation email

  res.json({
    message: 'Membership cancelled successfully',
    membership: cancelledMembership
  });
}));

// Get membership history
router.get('/history', verifyToken, catchAsync(async (req, res) => {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch membership history', 500);
  }

  res.json({ memberships });
}));

// Get all memberships (admin only)
router.get('/all', verifyToken, catchAsync(async (req, res) => {
  // Check if user is admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (userData?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { page = 1, limit = 20, status, membership_type } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('memberships')
    .select(`
      *,
      users:user_id (
        first_name,
        last_name,
        email,
        phone
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (membership_type) {
    query = query.eq('membership_type', membership_type);
  }

  const { data: memberships, error, count } = await query;

  if (error) {
    throw new AppError('Failed to fetch memberships', 500);
  }

  res.json({
    memberships,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Verify student/alumni status (admin only)
router.put('/:id/verify', verifyToken, [
  body('school_verification')
    .isBoolean()
    .withMessage('School verification must be true or false'),
  body('verification_notes')
    .optional()
    .isString()
    .withMessage('Verification notes must be a string')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Check if user is admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (userData?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;
  const { school_verification, verification_notes } = req.body;

  const { data: updatedMembership, error } = await supabase
    .from('memberships')
    .update({
      school_verification,
      // Store verification notes in metadata if needed
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update verification status', 500);
  }

  if (!updatedMembership) {
    throw new AppError('Membership not found', 404);
  }

  res.json({
    message: 'Verification status updated successfully',
    membership: updatedMembership
  });
}));

// Get membership statistics (admin only)
router.get('/stats/overview', verifyToken, catchAsync(async (req, res) => {
  // Check if user is admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (userData?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { data: memberships } = await supabase
    .from('memberships')
    .select('membership_type, status, annual_fee, created_at');

  const stats = {
    total: memberships.length,
    active: memberships.filter(m => m.status === 'active').length,
    by_type: {},
    by_status: {},
    total_revenue: 0,
    monthly_signups: {}
  };

  memberships.forEach(membership => {
    // Count by type
    stats.by_type[membership.membership_type] = (stats.by_type[membership.membership_type] || 0) + 1;
    
    // Count by status
    stats.by_status[membership.status] = (stats.by_status[membership.status] || 0) + 1;
    
    // Calculate revenue
    if (membership.status === 'active') {
      stats.total_revenue += membership.annual_fee;
    }
    
    // Monthly signups
    const month = moment(membership.created_at).format('YYYY-MM');
    stats.monthly_signups[month] = (stats.monthly_signups[month] || 0) + 1;
  });

  res.json({ stats });
}));

module.exports = router;