// Admin routes for course management
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const moment = require('moment');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', catchAsync(async (req, res) => {
  // Get today's bookings
  const { data: todayBookings } = await supabase
    .from('tee_times')
    .select('*')
    .eq('booking_date', moment().format('YYYY-MM-DD'))
    .eq('status', 'confirmed');

  // Get active memberships
  const { data: activeMemberships } = await supabase
    .from('memberships')
    .select('*')
    .eq('status', 'active')
    .gte('end_date', moment().format('YYYY-MM-DD'));

  // Get upcoming events
  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', moment().format('YYYY-MM-DD'))
    .eq('status', 'upcoming')
    .limit(5);

  // Get recent contact messages
  const { data: recentMessages } = await supabase
    .from('contact_messages')
    .select('*')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get revenue statistics
  const { data: revenueData } = await supabase
    .from('payment_transactions')
    .select('amount, transaction_date, transaction_type')
    .eq('status', 'completed')
    .gte('transaction_date', moment().startOf('month').toISOString());

  const monthlyRevenue = revenueData.reduce((sum, transaction) => sum + transaction.amount, 0);

  // Get booking statistics for the week
  const weekStart = moment().startOf('week').format('YYYY-MM-DD');
  const weekEnd = moment().endOf('week').format('YYYY-MM-DD');
  
  const { data: weekBookings } = await supabase
    .from('tee_times')
    .select('booking_date')
    .gte('booking_date', weekStart)
    .lte('booking_date', weekEnd)
    .eq('status', 'confirmed');

  const dailyBookings = {};
  for (let i = 0; i < 7; i++) {
    const date = moment().startOf('week').add(i, 'days').format('YYYY-MM-DD');
    dailyBookings[date] = weekBookings.filter(b => b.booking_date === date).length;
  }

  res.json({
    overview: {
      today_bookings: todayBookings.length,
      active_memberships: activeMemberships.length,
      upcoming_events: upcomingEvents.length,
      pending_messages: recentMessages.length,
      monthly_revenue: monthlyRevenue
    },
    today_bookings: todayBookings,
    upcoming_events: upcomingEvents,
    recent_messages: recentMessages,
    daily_bookings: dailyBookings
  });
}));

// Get all settings
router.get('/settings', catchAsync(async (req, res) => {
  const { data: settings, error } = await supabase
    .from('admin_settings')
    .select('*')
    .order('category', { ascending: true })
    .order('setting_key', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch settings', 500);
  }

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    const category = setting.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {});

  res.json({ settings: groupedSettings });
}));

// Update setting
router.put('/settings/:key', [
  body('setting_value')
    .notEmpty()
    .withMessage('Setting value is required'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { key } = req.params;
  const { setting_value, description } = req.body;

  const updates = { setting_value };
  if (description !== undefined) {
    updates.description = description;
  }

  const { data: updatedSetting, error } = await supabase
    .from('admin_settings')
    .update(updates)
    .eq('setting_key', key)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update setting', 500);
  }

  if (!updatedSetting) {
    throw new AppError('Setting not found', 404);
  }

  res.json({
    message: 'Setting updated successfully',
    setting: updatedSetting
  });
}));

// Create new setting
router.post('/settings', [
  body('setting_key')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Setting key is required and must be less than 100 characters'),
  body('setting_value')
    .notEmpty()
    .withMessage('Setting value is required'),
  body('setting_type')
    .isIn(['string', 'number', 'boolean', 'json'])
    .withMessage('Invalid setting type'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('Is public must be true or false')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const settingData = req.body;

  const { data: newSetting, error } = await supabase
    .from('admin_settings')
    .insert(settingData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new AppError('Setting key already exists', 409);
    }
    throw new AppError('Failed to create setting', 500);
  }

  res.status(201).json({
    message: 'Setting created successfully',
    setting: newSetting
  });
}));

// Update course conditions
router.post('/course-conditions', [
  body('condition_date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('overall_condition')
    .isIn(['excellent', 'good', 'fair', 'poor', 'closed'])
    .withMessage('Invalid overall condition'),
  body('greens_condition')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor'])
    .withMessage('Invalid greens condition'),
  body('fairways_condition')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor'])
    .withMessage('Invalid fairways condition'),
  body('cart_path_condition')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor'])
    .withMessage('Invalid cart path condition'),
  body('holes_available')
    .optional()
    .isInt({ min: 0, max: 9 })
    .withMessage('Holes available must be between 0 and 9'),
  body('special_notes')
    .optional()
    .isString()
    .withMessage('Special notes must be a string')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const conditionData = req.body;

  // Use upsert to update existing or create new
  const { data: conditions, error } = await supabase
    .from('course_conditions')
    .upsert(conditionData, { onConflict: 'condition_date' })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update course conditions', 500);
  }

  res.json({
    message: 'Course conditions updated successfully',
    conditions
  });
}));

// Get course conditions history
router.get('/course-conditions', [
  query('start_date').optional().isISO8601().withMessage('Valid start date required'),
  query('end_date').optional().isISO8601().withMessage('Valid end date required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { start_date, end_date } = req.query;

  let query = supabase
    .from('course_conditions')
    .select('*')
    .order('condition_date', { ascending: false });

  if (start_date) {
    query = query.gte('condition_date', start_date);
  }

  if (end_date) {
    query = query.lte('condition_date', end_date);
  }

  const { data: conditions, error } = await query;

  if (error) {
    throw new AppError('Failed to fetch course conditions', 500);
  }

  res.json({ conditions });
}));

// Get revenue reports
router.get('/reports/revenue', [
  query('start_date').optional().isISO8601().withMessage('Valid start date required'),
  query('end_date').optional().isISO8601().withMessage('Valid end date required'),
  query('group_by').optional().isIn(['day', 'week', 'month']).withMessage('Invalid group by option')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { 
    start_date = moment().subtract(30, 'days').format('YYYY-MM-DD'),
    end_date = moment().format('YYYY-MM-DD'),
    group_by = 'day'
  } = req.query;

  const { data: transactions, error } = await supabase
    .from('payment_transactions')
    .select('amount, transaction_date, transaction_type')
    .eq('status', 'completed')
    .gte('transaction_date', start_date)
    .lte('transaction_date', end_date)
    .order('transaction_date', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch revenue data', 500);
  }

  // Group transactions by specified period
  const groupedData = {};
  const totalByType = {};

  transactions.forEach(transaction => {
    let groupKey;
    const date = moment(transaction.transaction_date);

    switch (group_by) {
      case 'week':
        groupKey = date.startOf('week').format('YYYY-MM-DD');
        break;
      case 'month':
        groupKey = date.format('YYYY-MM');
        break;
      default:
        groupKey = date.format('YYYY-MM-DD');
    }

    if (!groupedData[groupKey]) {
      groupedData[groupKey] = 0;
    }
    groupedData[groupKey] += transaction.amount;

    // Track by transaction type
    if (!totalByType[transaction.transaction_type]) {
      totalByType[transaction.transaction_type] = 0;
    }
    totalByType[transaction.transaction_type] += transaction.amount;
  });

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

  res.json({
    revenue_by_period: groupedData,
    revenue_by_type: totalByType,
    total_revenue: totalRevenue,
    period: { start_date, end_date, group_by }
  });
}));

// Get booking reports
router.get('/reports/bookings', [
  query('start_date').optional().isISO8601().withMessage('Valid start date required'),
  query('end_date').optional().isISO8601().withMessage('Valid end date required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { 
    start_date = moment().subtract(30, 'days').format('YYYY-MM-DD'),
    end_date = moment().format('YYYY-MM-DD')
  } = req.query;

  const { data: bookings, error } = await supabase
    .from('tee_times')
    .select('booking_date, status, number_of_players, green_fee_type, cart_rental')
    .gte('booking_date', start_date)
    .lte('booking_date', end_date);

  if (error) {
    throw new AppError('Failed to fetch booking data', 500);
  }

  // Analyze booking data
  const dailyBookings = {};
  const statusCounts = {};
  const feeTypeCounts = {};
  let totalPlayers = 0;
  let cartRentals = 0;

  bookings.forEach(booking => {
    // Daily bookings
    if (!dailyBookings[booking.booking_date]) {
      dailyBookings[booking.booking_date] = 0;
    }
    dailyBookings[booking.booking_date]++;

    // Status counts
    statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;

    // Fee type counts
    feeTypeCounts[booking.green_fee_type] = (feeTypeCounts[booking.green_fee_type] || 0) + 1;

    // Player and cart statistics
    totalPlayers += booking.number_of_players;
    if (booking.cart_rental) cartRentals++;
  });

  res.json({
    daily_bookings: dailyBookings,
    status_breakdown: statusCounts,
    fee_type_breakdown: feeTypeCounts,
    total_bookings: bookings.length,
    total_players: totalPlayers,
    cart_rentals: cartRentals,
    average_players_per_booking: bookings.length > 0 ? (totalPlayers / bookings.length).toFixed(2) : 0,
    period: { start_date, end_date }
  });
}));

// Get membership reports
router.get('/reports/memberships', catchAsync(async (req, res) => {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('membership_type, status, annual_fee, start_date, end_date');

  if (error) {
    throw new AppError('Failed to fetch membership data', 500);
  }

  const typeBreakdown = {};
  const statusBreakdown = {};
  let totalRevenue = 0;
  let activeCount = 0;
  const monthlySignups = {};

  memberships.forEach(membership => {
    // Type breakdown
    typeBreakdown[membership.membership_type] = (typeBreakdown[membership.membership_type] || 0) + 1;

    // Status breakdown
    statusBreakdown[membership.status] = (statusBreakdown[membership.status] || 0) + 1;

    // Revenue calculation
    if (membership.status === 'active') {
      totalRevenue += membership.annual_fee;
      activeCount++;
    }

    // Monthly signups
    const month = moment(membership.start_date).format('YYYY-MM');
    monthlySignups[month] = (monthlySignups[month] || 0) + 1;
  });

  res.json({
    type_breakdown: typeBreakdown,
    status_breakdown: statusBreakdown,
    total_memberships: memberships.length,
    active_memberships: activeCount,
    total_annual_revenue: totalRevenue,
    monthly_signups: monthlySignups
  });
}));

// Export data (CSV format)
router.get('/export/:type', [
  query('start_date').optional().isISO8601().withMessage('Valid start date required'),
  query('end_date').optional().isISO8601().withMessage('Valid end date required')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { type } = req.params;
  const { start_date, end_date } = req.query;

  let data, filename;

  switch (type) {
    case 'bookings':
      const bookingQuery = supabase
        .from('tee_times')
        .select(`
          booking_date,
          tee_time,
          primary_player_name,
          primary_player_email,
          number_of_players,
          green_fee_type,
          total_amount,
          status,
          created_at
        `)
        .order('booking_date', { ascending: false });

      if (start_date) bookingQuery.gte('booking_date', start_date);
      if (end_date) bookingQuery.lte('booking_date', end_date);

      const { data: bookings } = await bookingQuery;
      data = bookings;
      filename = `bookings_${moment().format('YYYY-MM-DD')}.csv`;
      break;

    case 'memberships':
      const { data: memberships } = await supabase
        .from('memberships')
        .select(`
          membership_type,
          annual_fee,
          status,
          start_date,
          end_date,
          users:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('start_date', { ascending: false });

      data = memberships.map(m => ({
        ...m,
        user_name: `${m.users?.first_name} ${m.users?.last_name}`,
        user_email: m.users?.email
      }));
      filename = `memberships_${moment().format('YYYY-MM-DD')}.csv`;
      break;

    default:
      throw new AppError('Invalid export type', 400);
  }

  // Convert to CSV
  if (data.length === 0) {
    return res.json({ message: 'No data to export' });
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}));

module.exports = router;