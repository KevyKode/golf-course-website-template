// Events routes for tournaments and special events
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const moment = require('moment');

const router = express.Router();

// Get upcoming public events
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('event_type').optional().isIn(['tournament', 'lesson', 'social', 'special']).withMessage('Invalid event type')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { page = 1, limit = 20, event_type } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .gte('event_date', moment().format('YYYY-MM-DD'))
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })
    .range(offset, offset + limit - 1);

  if (event_type) {
    query = query.eq('event_type', event_type);
  }

  const { data: events, error, count } = await query;

  if (error) {
    throw new AppError('Failed to fetch events', 500);
  }

  // Add registration count for each event
  const eventsWithRegistrations = await Promise.all(
    events.map(async (event) => {
      const { data: registrations } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', event.id)
        .eq('status', 'registered');

      return {
        ...event,
        current_registrations: registrations?.length || 0,
        spots_available: event.max_participants ? event.max_participants - (registrations?.length || 0) : null,
        is_full: event.max_participants ? (registrations?.length || 0) >= event.max_participants : false
      };
    })
  );

  res.json({
    events: eventsWithRegistrations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Get event by ID
router.get('/:id', optionalAuth, catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !event) {
    throw new AppError('Event not found', 404);
  }

  // Check if event is public or user has access
  if (!event.is_public && !req.user) {
    throw new AppError('Event not found', 404);
  }

  // Get registration count
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'registered');

  // Check if current user is registered
  let userRegistration = null;
  if (req.user) {
    const { data: userReg } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', event.id)
      .eq('user_id', req.user.id)
      .single();
    
    userRegistration = userReg;
  }

  const eventWithDetails = {
    ...event,
    current_registrations: registrations?.length || 0,
    spots_available: event.max_participants ? event.max_participants - (registrations?.length || 0) : null,
    is_full: event.max_participants ? (registrations?.length || 0) >= event.max_participants : false,
    user_registered: !!userRegistration,
    user_registration: userRegistration
  };

  res.json({ event: eventWithDetails });
}));

// Register for event
router.post('/:id/register', verifyToken, [
  body('participant_name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Participant name is required'),
  body('participant_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('participant_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('team_members')
    .optional()
    .isArray()
    .withMessage('Team members must be an array'),
  body('handicap')
    .optional()
    .isFloat({ min: 0, max: 54 })
    .withMessage('Handicap must be between 0 and 54'),
  body('special_requirements')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special requirements must be less than 500 characters')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const {
    participant_name,
    participant_email,
    participant_phone,
    team_members,
    handicap,
    special_requirements
  } = req.body;

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (eventError || !event) {
    throw new AppError('Event not found', 404);
  }

  // Check if event is still open for registration
  if (event.status !== 'upcoming') {
    throw new AppError('Event registration is closed', 400);
  }

  // Check registration deadline
  if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
    throw new AppError('Registration deadline has passed', 400);
  }

  // Check if user is already registered
  const { data: existingRegistration } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', id)
    .eq('user_id', req.user.id)
    .single();

  if (existingRegistration) {
    throw new AppError('You are already registered for this event', 409);
  }

  // Check if event is full
  const { data: currentRegistrations } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', id)
    .eq('status', 'registered');

  if (event.max_participants && currentRegistrations.length >= event.max_participants) {
    throw new AppError('Event is full', 400);
  }

  // Check membership requirement
  if (event.requires_membership) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .gte('end_date', moment().format('YYYY-MM-DD'))
      .single();

    if (!membership) {
      throw new AppError('Active membership required for this event', 403);
    }
  }

  // Calculate registration fee (apply member discount if applicable)
  let registrationFee = event.entry_fee || 0;
  
  if (event.member_discount > 0 && event.requires_membership) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (membership) {
      registrationFee = registrationFee * (1 - event.member_discount / 100);
    }
  }

  // Create registration
  const registrationData = {
    event_id: id,
    user_id: req.user.id,
    participant_name,
    participant_email,
    participant_phone,
    team_members: team_members || null,
    handicap,
    special_requirements,
    registration_fee: registrationFee,
    payment_status: registrationFee > 0 ? 'pending' : 'paid',
    status: 'registered'
  };

  const { data: registration, error } = await supabase
    .from('event_registrations')
    .insert(registrationData)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to register for event', 500);
  }

  // Update event participant count
  await supabase
    .from('events')
    .update({ current_participants: currentRegistrations.length + 1 })
    .eq('id', id);

  // TODO: Create payment intent if fee > 0
  // TODO: Send registration confirmation email

  res.status(201).json({
    message: 'Event registration successful',
    registration,
    payment_required: registrationFee > 0
  });
}));

// Cancel event registration
router.delete('/:id/register', verifyToken, catchAsync(async (req, res) => {
  const { id } = req.params;

  // Get existing registration
  const { data: registration, error: regError } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', id)
    .eq('user_id', req.user.id)
    .single();

  if (regError || !registration) {
    throw new AppError('Registration not found', 404);
  }

  // Get event details to check cancellation policy
  const { data: event } = await supabase
    .from('events')
    .select('event_date, start_time')
    .eq('id', id)
    .single();

  // Check if cancellation is allowed (e.g., 48 hours before event)
  const eventDateTime = moment(`${event.event_date} ${event.start_time}`);
  const hoursUntilEvent = eventDateTime.diff(moment(), 'hours');

  if (hoursUntilEvent < 48) {
    throw new AppError('Cannot cancel registration within 48 hours of event', 400);
  }

  // Cancel registration
  const { data: cancelledRegistration, error } = await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registration.id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to cancel registration', 500);
  }

  // Update event participant count
  const { data: currentRegistrations } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', id)
    .eq('status', 'registered');

  await supabase
    .from('events')
    .update({ current_participants: currentRegistrations.length })
    .eq('id', id);

  // TODO: Process refund if payment was made
  // TODO: Send cancellation confirmation email

  res.json({
    message: 'Event registration cancelled successfully',
    registration: cancelledRegistration
  });
}));

// Get user's event registrations
router.get('/my-registrations', verifyToken, catchAsync(async (req, res) => {
  const { data: registrations, error } = await supabase
    .from('event_registrations')
    .select(`
      *,
      events:event_id (
        title,
        event_date,
        start_time,
        event_type,
        status
      )
    `)
    .eq('user_id', req.user.id)
    .order('registration_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch registrations', 500);
  }

  res.json({ registrations });
}));

// Create new event (admin only)
router.post('/', verifyToken, [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('event_type')
    .isIn(['tournament', 'lesson', 'social', 'maintenance', 'special'])
    .withMessage('Invalid event type'),
  body('event_date')
    .isISO8601()
    .withMessage('Valid event date is required'),
  body('start_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time required (HH:MM)'),
  body('end_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time required (HH:MM)'),
  body('max_participants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max participants must be a positive integer'),
  body('entry_fee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Entry fee must be a positive number'),
  body('member_discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Member discount must be between 0 and 100'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('Is public must be true or false'),
  body('requires_membership')
    .optional()
    .isBoolean()
    .withMessage('Requires membership must be true or false')
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

  const eventData = {
    ...req.body,
    current_participants: 0,
    status: 'upcoming'
  };

  const { data: event, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create event', 500);
  }

  res.status(201).json({
    message: 'Event created successfully',
    event
  });
}));

// Update event (admin only)
router.put('/:id', verifyToken, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('status')
    .optional()
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Invalid status')
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
  const updates = req.body;

  const { data: updatedEvent, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update event', 500);
  }

  if (!updatedEvent) {
    throw new AppError('Event not found', 404);
  }

  res.json({
    message: 'Event updated successfully',
    event: updatedEvent
  });
}));

// Get event registrations (admin only)
router.get('/:id/registrations', verifyToken, catchAsync(async (req, res) => {
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

  const { data: registrations, error } = await supabase
    .from('event_registrations')
    .select(`
      *,
      users:user_id (
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('event_id', id)
    .order('registration_date', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch event registrations', 500);
  }

  res.json({ registrations });
}));

module.exports = router;