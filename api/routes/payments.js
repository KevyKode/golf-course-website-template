// Payment routes for Stripe integration
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Create payment intent for tee time booking
router.post('/create-booking-payment', verifyToken, [
  body('booking_id')
    .isUUID()
    .withMessage('Valid booking ID is required'),
  body('amount')
    .isFloat({ min: 0.50 })
    .withMessage('Amount must be at least $0.50')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { booking_id, amount } = req.body;

  // Verify booking exists and belongs to user
  const { data: booking, error: bookingError } = await supabase
    .from('tee_times')
    .select('*')
    .eq('id', booking_id)
    .eq('user_id', req.user.id)
    .single();

  if (bookingError || !booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.payment_status === 'paid') {
    throw new AppError('Booking is already paid', 400);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    metadata: {
      booking_id: booking_id,
      user_id: req.user.id,
      type: 'tee_time'
    },
    description: `Tee time booking for ${booking.booking_date} at ${booking.tee_time}`
  });

  // Update booking with payment intent ID
  await supabase
    .from('tee_times')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', booking_id);

  // Create payment transaction record
  await supabase
    .from('payment_transactions')
    .insert({
      transaction_type: 'tee_time',
      amount: amount,
      payment_provider: 'stripe',
      provider_transaction_id: paymentIntent.id,
      user_id: req.user.id,
      tee_time_id: booking_id,
      status: 'pending'
    });

  res.json({
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id
  });
}));

// Create payment intent for membership
router.post('/create-membership-payment', verifyToken, [
  body('membership_id')
    .isUUID()
    .withMessage('Valid membership ID is required'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1.00')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { membership_id, amount } = req.body;

  // Verify membership exists and belongs to user
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', membership_id)
    .eq('user_id', req.user.id)
    .single();

  if (membershipError || !membership) {
    throw new AppError('Membership not found', 404);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    metadata: {
      membership_id: membership_id,
      user_id: req.user.id,
      type: 'membership'
    },
    description: `${membership.membership_type} membership for ${new Date().getFullYear()}`
  });

  // Update membership with payment intent ID
  await supabase
    .from('memberships')
    .update({ stripe_subscription_id: paymentIntent.id })
    .eq('id', membership_id);

  // Create payment transaction record
  await supabase
    .from('payment_transactions')
    .insert({
      transaction_type: 'membership',
      amount: amount,
      payment_provider: 'stripe',
      provider_transaction_id: paymentIntent.id,
      user_id: req.user.id,
      membership_id: membership_id,
      status: 'pending'
    });

  res.json({
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id
  });
}));

// Create payment intent for event registration
router.post('/create-event-payment', verifyToken, [
  body('registration_id')
    .isUUID()
    .withMessage('Valid registration ID is required'),
  body('amount')
    .isFloat({ min: 0.50 })
    .withMessage('Amount must be at least $0.50')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { registration_id, amount } = req.body;

  // Verify registration exists and belongs to user
  const { data: registration, error: registrationError } = await supabase
    .from('event_registrations')
    .select(`
      *,
      events:event_id (
        title,
        event_date
      )
    `)
    .eq('id', registration_id)
    .eq('user_id', req.user.id)
    .single();

  if (registrationError || !registration) {
    throw new AppError('Event registration not found', 404);
  }

  if (registration.payment_status === 'paid') {
    throw new AppError('Registration is already paid', 400);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    metadata: {
      registration_id: registration_id,
      user_id: req.user.id,
      type: 'event'
    },
    description: `Event registration for ${registration.events.title} on ${registration.events.event_date}`
  });

  // Update registration with payment intent ID
  await supabase
    .from('event_registrations')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', registration_id);

  // Create payment transaction record
  await supabase
    .from('payment_transactions')
    .insert({
      transaction_type: 'event',
      amount: amount,
      payment_provider: 'stripe',
      provider_transaction_id: paymentIntent.id,
      user_id: req.user.id,
      event_registration_id: registration_id,
      status: 'pending'
    });

  res.json({
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id
  });
}));

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handleSubscriptionPayment(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}));

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  const { metadata } = paymentIntent;
  
  // Update payment transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'completed',
      transaction_date: new Date().toISOString()
    })
    .eq('provider_transaction_id', paymentIntent.id);

  // Update related record based on type
  switch (metadata.type) {
    case 'tee_time':
      await supabase
        .from('tee_times')
        .update({ payment_status: 'paid' })
        .eq('id', metadata.booking_id);
      
      // TODO: Send booking confirmation email
      break;
      
    case 'membership':
      await supabase
        .from('memberships')
        .update({ 
          payment_method: 'stripe',
          status: 'active'
        })
        .eq('id', metadata.membership_id);
      
      // TODO: Send membership welcome email
      break;
      
    case 'event':
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'paid' })
        .eq('id', metadata.registration_id);
      
      // TODO: Send event registration confirmation email
      break;
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent) {
  const { metadata } = paymentIntent;
  
  // Update payment transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'failed',
      failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed'
    })
    .eq('provider_transaction_id', paymentIntent.id);

  // Update related record based on type
  switch (metadata.type) {
    case 'tee_time':
      await supabase
        .from('tee_times')
        .update({ payment_status: 'failed' })
        .eq('id', metadata.booking_id);
      break;
      
    case 'event':
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'failed' })
        .eq('id', metadata.registration_id);
      break;
  }
  
  // TODO: Send payment failure notification email
}

// Handle subscription payment
async function handleSubscriptionPayment(invoice) {
  // Handle recurring membership payments
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  
  if (subscription.metadata.type === 'membership') {
    // Extend membership end date
    const { data: membership } = await supabase
      .from('memberships')
      .select('end_date')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    if (membership) {
      const newEndDate = moment(membership.end_date).add(1, 'year').format('YYYY-MM-DD');
      
      await supabase
        .from('memberships')
        .update({ end_date: newEndDate })
        .eq('stripe_subscription_id', subscription.id);
      
      // Create payment transaction record
      await supabase
        .from('payment_transactions')
        .insert({
          transaction_type: 'membership',
          amount: invoice.amount_paid / 100,
          payment_provider: 'stripe',
          provider_transaction_id: invoice.id,
          status: 'completed',
          transaction_date: new Date().toISOString()
        });
    }
  }
}

// Get payment history for user
router.get('/history', verifyToken, catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { data: transactions, error, count } = await supabase
    .from('payment_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError('Failed to fetch payment history', 500);
  }

  res.json({
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Get payment details
router.get('/payment/:payment_intent_id', verifyToken, catchAsync(async (req, res) => {
  const { payment_intent_id } = req.params;

  // Get payment intent from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

  // Verify user owns this payment
  if (paymentIntent.metadata.user_id !== req.user.id) {
    throw new AppError('Payment not found', 404);
  }

  // Get transaction record
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('provider_transaction_id', payment_intent_id)
    .single();

  res.json({
    payment_intent: {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      created: paymentIntent.created,
      description: paymentIntent.description
    },
    transaction
  });
}));

// Request refund (admin only)
router.post('/refund', verifyToken, [
  body('payment_intent_id')
    .notEmpty()
    .withMessage('Payment intent ID is required'),
  body('amount')
    .optional()
    .isFloat({ min: 0.50 })
    .withMessage('Refund amount must be at least $0.50'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
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

  const { payment_intent_id, amount, reason } = req.body;

  // Create refund
  const refund = await stripe.refunds.create({
    payment_intent: payment_intent_id,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason: reason || 'requested_by_customer'
  });

  // Update transaction record
  await supabase
    .from('payment_transactions')
    .update({ status: 'refunded' })
    .eq('provider_transaction_id', payment_intent_id);

  // Create refund transaction record
  await supabase
    .from('payment_transactions')
    .insert({
      transaction_type: 'refund',
      amount: -(refund.amount / 100),
      payment_provider: 'stripe',
      provider_transaction_id: refund.id,
      status: 'completed',
      transaction_date: new Date().toISOString(),
      metadata: { original_payment: payment_intent_id, reason }
    });

  res.json({
    message: 'Refund processed successfully',
    refund: {
      id: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    }
  });
}));

module.exports = router;