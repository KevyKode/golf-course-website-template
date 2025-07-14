// Booking routes for tee time management
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const moment = require('moment-timezone');

const router = express.Router();

// Validation rules
const bookingValidation = [
  body('booking_date')
    .isISO8601()
    .withMessage('Valid date is required')
    .custom(async (value, { req }) => {
      const bookingDate = moment(value);
      const today = moment().startOf('day');
      
      // Default max advance days
      let maxAdvanceDays = 30; // Default for non-members
      
      // Check if user is logged in and is a member
      if (req.user) {
        const { data: membership, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', req.user.id)
          .eq('status', 'active')
          .gte('end_date', moment().format('YYYY-MM-DD'))
          .single();

        if (membership) {
          // Fetch member priority booking days from admin settings
          const { data: setting } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'member_booking_advance_days')
            .single();
          
          maxAdvanceDays = parseInt(setting?.setting_value || 60); // Members can book 60 days in advance by default
        }
      }

      const maxAdvance = moment().add(maxAdvanceDays, 'days');
      
      if (bookingDate.isBefore(today)) {
        throw new Error('Cannot book tee times in the past');
      }
      
      if (bookingDate.isAfter(maxAdvance)) {
        throw new Error(`Cannot book more than ${maxAdvanceDays} days in advance`);
      }
      
      return true;
    }),
  body('tee_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time format required (HH:MM)'),
  body('number_of_players')
    .isInt({ min: 1, max: 4 })
    .withMessage('Number of players must be between 1 and 4'),
  body('primary_player_name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Primary player name is required'),
  body('primary_player_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('primary_player_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('cart_rental')
    .optional()
    .isBoolean()
    .withMessage('Cart rental must be true or false'),
  body('green_fee_type')
    .isIn(['9_holes', 'all_day'])
    .withMessage('Green fee type must be 9_holes or all_day')
];

// Get available tee times for a specific date
router.get('/availability', [
  query('date')
    .isISO8601()
    .withMessage('Valid date is required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { date } = req.query;
  
  // Get course settings
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['course_open_time', 'course_close_time', 'tee_time_interval']);
  
  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.setting_key] = setting.setting_value;
    return acc;
  }, {});
  
  const openTime = settingsMap.course_open_time || '07:00';
  const closeTime = settingsMap.course_close_time || '19:00';
  const interval = parseInt(settingsMap.tee_time_interval) || 15;
  
  // Generate time slots
  const timeSlots = [];
  const start = moment(`${date} ${openTime}`, 'YYYY-MM-DD HH:mm');
  const end = moment(`${date} ${closeTime}`, 'YYYY-MM-DD HH:mm');
  
  while (start.isBefore(end)) {
    timeSlots.push(start.format('HH:mm'));
    start.add(interval, 'minutes');
  }
  
  // Get existing bookings for the date
  const { data: bookings } = await supabase
    .from('tee_times')
    .select('tee_time')
    .eq('booking_date', date)
    .eq('status', 'confirmed');
  
  const bookedTimes = bookings.map(booking => booking.tee_time);
  
  // Check course conditions
  const { data: conditions } = await supabase
    .from('course_conditions')
    .select('overall_condition, holes_available')
    .eq('condition_date', date)
    .single();
  
  const availability = timeSlots.map(time => ({
    time,
    available: !bookedTimes.includes(time) && 
               (conditions?.overall_condition !== 'closed') &&
               (conditions?.holes_available > 0)
  }));
  
  res.json({
    date,
    course_condition: conditions?.overall_condition || 'good',
    holes_available: conditions?.holes_available || 9,
    time_slots: availability
  });
}));

// Get user's bookings
router.get('/my-bookings', verifyToken, catchAsync(async (req, res) => {
  const { data: bookings, error } = await supabase
    .from('tee_times')
    .select(`
      *,
      users:user_id (
        first_name,
        last_name,
        email
      )
    `)
    .eq('user_id', req.user.id)
    .gte('booking_date', moment().format('YYYY-MM-DD'))
    .order('booking_date', { ascending: true })
    .order('tee_time', { ascending: true });
  
  if (error) {
    throw new AppError('Failed to fetch bookings', 500);
  }
  
  res.json({ bookings });
}));

// Get all upcoming bookings (admin only)
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
  
  const { page = 1, limit = 20, date } = req.query;
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('tee_times')
    .select(`
      *,
      users:user_id (
        first_name,
        last_name,
        email,
        phone
      )
    `, { count: 'exact' })
    .order('booking_date', { ascending: true })
    .order('tee_time', { ascending: true })
    .range(offset, offset + limit - 1);
  
  if (date) {
    query = query.eq('booking_date', date);
  } else {
    query = query.gte('booking_date', moment().format('YYYY-MM-DD'));
  }
  
  const { data: bookings, error, count } = await query;
  
  if (error) {
    throw new AppError('Failed to fetch bookings', 500);
  }
  
  res.json({
    bookings,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Create new booking
router.post('/', bookingValidation, optionalAuth, catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    booking_date,
    tee_time,
    number_of_players,
    primary_player_name,
    primary_player_email,
    primary_player_phone,
    additional_players,
    cart_rental,
    green_fee_type,
    special_requests
  } = req.body;

  // Check if time slot is available
  const { data: existingBooking } = await supabase
    .from('tee_times')
    .select('id')
    .eq('booking_date', booking_date)
    .eq('tee_time', tee_time)
    .eq('status', 'confirmed')
    .single();

  if (existingBooking) {
    throw new AppError('This tee time is already booked', 409);
  }

  // Get pricing
  const { data: pricing } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['green_fee_9_holes', 'green_fee_all_day', 'cart_rental_fee']);

  const pricingMap = pricing.reduce((acc, setting) => {
    acc[setting.setting_key] = parseFloat(setting.setting_value);
    return acc;
  }, {});

  const greenFee = green_fee_type === '9_holes' 
    ? pricingMap.green_fee_9_holes || 10
    : pricingMap.green_fee_all_day || 15;
  
  const cartFee = cart_rental ? (pricingMap.cart_rental_fee || 15) : 0;
  const totalGreenFees = greenFee * number_of_players;
  const totalCartFees = cartFee;
  const totalAmount = totalGreenFees + totalCartFees;

  // Create booking
  const bookingData = {
    user_id: req.user?.id || null, // Assign user_id if logged in
    booking_date,
    tee_time,
    number_of_players,
    primary_player_name,
    primary_player_email,
    primary_player_phone,
    additional_players: additional_players || null,
    cart_rental: cart_rental || false,
    cart_rental_fee: totalCartFees,
    special_requests,
    green_fee_type,
    total_green_fees: totalGreenFees,
    total_cart_fees: totalCartFees,
    total_amount: totalAmount,
    payment_status: 'pending',
    status: 'confirmed'
  };

  const { data: booking, error } = await supabase
    .from('tee_times')
    .insert(bookingData)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create booking', 500);
  }

  // TODO: Send confirmation email
  // TODO: Create payment intent if payment required

  res.status(201).json({
    message: 'Booking created successfully',
    booking,
    payment_required: totalAmount > 0
  });
}));

// Update booking
router.put('/:id', verifyToken, [
  body('cart_rental').optional().isBoolean(),
  body('special_requests').optional().isString(),
  body('additional_players').optional().isArray()
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  // Get existing booking
  const { data: existingBooking, error: fetchError } = await supabase
    .from('tee_times')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingBooking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership or admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (existingBooking.user_id !== req.user.id && userData?.role !== 'admin') {
    throw new AppError('Not authorized to update this booking', 403);
  }

  // Check if booking can be modified (not in the past, not within 24 hours)
  const bookingDateTime = moment(`${existingBooking.booking_date} ${existingBooking.tee_time}`);
  const now = moment();
  const hoursUntilBooking = bookingDateTime.diff(now, 'hours');

  if (hoursUntilBooking < 24) {
    throw new AppError('Cannot modify booking within 24 hours of tee time', 400);
  }

  // Update cart rental fee if cart_rental changed
  if ('cart_rental' in updates) {
    const { data: cartFeeData } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'cart_rental_fee')
      .single();

    const cartFee = parseFloat(cartFeeData?.setting_value || 15);
    updates.cart_rental_fee = updates.cart_rental ? cartFee : 0;
    updates.total_cart_fees = updates.cart_rental_fee;
    updates.total_amount = existingBooking.total_green_fees + updates.total_cart_fees;
  }

  const { data: updatedBooking, error } = await supabase
    .from('tee_times')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update booking', 500);
  }

  res.json({
    message: 'Booking updated successfully',
    booking: updatedBooking
  });
}));

// Cancel booking
router.delete('/:id', verifyToken, [
  body('cancellation_reason').optional().isString()
], catchAsync(async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  // Get existing booking
  const { data: existingBooking, error: fetchError } = await supabase
    .from('tee_times')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingBooking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership or admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (existingBooking.user_id !== req.user.id && userData?.role !== 'admin') {
    throw new AppError('Not authorized to cancel this booking', 403);
  }

  // Check cancellation policy (24 hours notice)
  const bookingDateTime = moment(`${existingBooking.booking_date} ${existingBooking.tee_time}`);
  const now = moment();
  const hoursUntilBooking = bookingDateTime.diff(now, 'hours');

  if (hoursUntilBooking < 24) {
    throw new AppError('Cannot cancel booking within 24 hours of tee time', 400);
  }

  // Cancel booking
  const { data: cancelledBooking, error } = await supabase
    .from('tee_times')
    .update({
      status: 'cancelled',
      cancellation_reason,
      cancelled_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to cancel booking', 500);
  }

  // TODO: Process refund if payment was made
  // TODO: Send cancellation confirmation email

  res.json({
    message: 'Booking cancelled successfully',
    booking: cancelledBooking
  });
}));

// Get booking by ID
router.get('/:id', optionalAuth, catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data: booking, error } = await supabase
    .from('tee_times')
    .select(`
      *,
      users:user_id (
        first_name,
        last_name,
        email
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check if user can view this booking
  if (booking.user_id && req.user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (booking.user_id !== req.user.id && userData?.role !== 'admin') {
      throw new AppError('Not authorized to view this booking', 403);
    }
  }

  res.json({ booking });
}));

module.exports = router;