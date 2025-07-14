// Contact routes for handling contact form submissions
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const sgMail = require('@sendgrid/mail');

const router = express.Router();

// Initialize SendGrid if API key is provided
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Validation rules for contact form
const contactValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),
  body('message_type')
    .isIn(['tee_time', 'membership', 'events', 'general', 'feedback', 'complaint'])
    .withMessage('Invalid message type')
];

// Submit contact form
router.post('/', contactValidation, catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    email,
    phone,
    subject,
    message,
    message_type
  } = req.body;

  // Determine priority based on message type
  let priority = 'normal';
  if (message_type === 'complaint') {
    priority = 'high';
  } else if (message_type === 'tee_time') {
    priority = 'high';
  }

  // Save to database
  const { data: contactMessage, error } = await supabase
    .from('contact_messages')
    .insert({
      name,
      email,
      phone,
      subject,
      message,
      message_type,
      priority,
      status: 'new'
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to submit contact form', 500);
  }

  // Send email notification to course management
  if (process.env.SENDGRID_API_KEY) {
    try {
      const emailData = {
        to: process.env.SENDGRID_FROM_EMAIL || 'info@rookscountygolf.com',
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@rookscountygolf.com',
          name: process.env.SENDGRID_FROM_NAME || 'Rooks County Golf Course'
        },
        subject: `New Contact Form Submission: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2d5016;">New Contact Form Submission</h2>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2d5016;">Contact Information</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              <p><strong>Message Type:</strong> ${message_type.replace('_', ' ').toUpperCase()}</p>
              <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
            </div>
            
            <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #2d5016;">Subject</h3>
              <p>${subject}</p>
              
              <h3 style="color: #2d5016;">Message</h3>
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #e8f5e8; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; color: #2d5016;">
                <strong>Submitted:</strong> ${new Date().toLocaleString()}<br>
                <strong>Message ID:</strong> ${contactMessage.id}
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(emailData);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }
  }

  // Send auto-reply to customer
  if (process.env.SENDGRID_API_KEY) {
    try {
      const autoReplyData = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@rookscountygolf.com',
          name: process.env.SENDGRID_FROM_NAME || 'Rooks County Golf Course'
        },
        subject: 'Thank you for contacting Rooks County Golf Course',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px; background-color: #2d5016; color: white;">
              <h1 style="margin: 0;">🏌️ Rooks County Golf Course</h1>
            </div>
            
            <div style="padding: 30px; background-color: #fff;">
              <h2 style="color: #2d5016;">Thank You for Your Message!</h2>
              
              <p>Dear ${name},</p>
              
              <p>Thank you for contacting Rooks County Golf Course. We have received your message and will respond as soon as possible.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2d5016;">Your Message Details</h3>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message Type:</strong> ${message_type.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Reference ID:</strong> ${contactMessage.id}</p>
              </div>
              
              <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2d5016;">Expected Response Time</h3>
                <p>
                  ${priority === 'high' 
                    ? 'We will respond to your high-priority message within 4-6 hours during business hours.'
                    : 'We typically respond to messages within 24-48 hours during business hours.'
                  }
                </p>
              </div>
              
              <div style="border-top: 2px solid #2d5016; padding-top: 20px; margin-top: 30px;">
                <h3 style="color: #2d5016;">Contact Information</h3>
                <p>
                  <strong>Address:</strong> 1925 Highway 183, Between Stockton and Plainville, KS<br>
                  <strong>Phone:</strong> (785) 434-5555<br>
                  <strong>Email:</strong> info@rookscountygolf.com<br>
                  <strong>Hours:</strong> Dawn to Dusk, Daily
                </p>
                
                <p>
                  <strong>Green Fees:</strong><br>
                  • 9 Holes: $10<br>
                  • All Day: $15
                </p>
                
                <p style="margin-top: 20px;">
                  <a href="https://www.facebook.com/RCGolfCourse/" 
                     style="color: #2d5016; text-decoration: none;">
                    📘 Follow us on Facebook
                  </a>
                </p>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; background-color: #f8f9fa; color: #666;">
              <p style="margin: 0; font-size: 14px;">
                This is an automated response. Please do not reply to this email.
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(autoReplyData);
    } catch (emailError) {
      console.error('Failed to send auto-reply email:', emailError);
      // Don't fail the request if email fails
    }
  }

  res.status(201).json({
    message: 'Contact form submitted successfully',
    reference_id: contactMessage.id,
    expected_response: priority === 'high' 
      ? 'We will respond within 4-6 hours during business hours'
      : 'We will respond within 24-48 hours during business hours'
  });
}));

// Get contact messages (admin only)
router.get('/', catchAsync(async (req, res) => {
  // This would need authentication middleware for admin access
  const { page = 1, limit = 20, status, message_type, priority } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (message_type) {
    query = query.eq('message_type', message_type);
  }

  if (priority) {
    query = query.eq('priority', priority);
  }

  const { data: messages, error, count } = await query;

  if (error) {
    throw new AppError('Failed to fetch contact messages', 500);
  }

  res.json({
    messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Update contact message status (admin only)
router.put('/:id', [
  body('status')
    .optional()
    .isIn(['new', 'in_progress', 'responded', 'closed'])
    .withMessage('Invalid status'),
  body('response')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Response must be between 1 and 2000 characters'),
  body('assigned_to')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Assigned to must be between 1 and 200 characters')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  // If response is provided, set response_date
  if (updates.response) {
    updates.response_date = new Date().toISOString();
    if (!updates.status) {
      updates.status = 'responded';
    }
  }

  const { data: updatedMessage, error } = await supabase
    .from('contact_messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update contact message', 500);
  }

  if (!updatedMessage) {
    throw new AppError('Contact message not found', 404);
  }

  // Send response email if response was provided
  if (updates.response && process.env.SENDGRID_API_KEY) {
    try {
      const responseEmailData = {
        to: updatedMessage.email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@rookscountygolf.com',
          name: process.env.SENDGRID_FROM_NAME || 'Rooks County Golf Course'
        },
        subject: `Re: ${updatedMessage.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px; background-color: #2d5016; color: white;">
              <h1 style="margin: 0;">🏌️ Rooks County Golf Course</h1>
            </div>
            
            <div style="padding: 30px; background-color: #fff;">
              <h2 style="color: #2d5016;">Response to Your Inquiry</h2>
              
              <p>Dear ${updatedMessage.name},</p>
              
              <p>Thank you for contacting Rooks County Golf Course. Here is our response to your inquiry:</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2d5016;">Your Original Message</h3>
                <p><strong>Subject:</strong> ${updatedMessage.subject}</p>
                <p style="white-space: pre-wrap;">${updatedMessage.message}</p>
              </div>
              
              <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2d5016;">Our Response</h3>
                <p style="white-space: pre-wrap;">${updates.response}</p>
              </div>
              
              <p>If you have any additional questions, please don't hesitate to contact us again.</p>
              
              <div style="border-top: 2px solid #2d5016; padding-top: 20px; margin-top: 30px;">
                <h3 style="color: #2d5016;">Contact Information</h3>
                <p>
                  <strong>Address:</strong> 1925 Highway 183, Between Stockton and Plainville, KS<br>
                  <strong>Phone:</strong> (785) 434-5555<br>
                  <strong>Email:</strong> info@rookscountygolf.com
                </p>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; background-color: #f8f9fa; color: #666;">
              <p style="margin: 0; font-size: 14px;">
                Reference ID: ${updatedMessage.id}
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(responseEmailData);
    } catch (emailError) {
      console.error('Failed to send response email:', emailError);
      // Don't fail the request if email fails
    }
  }

  res.json({
    message: 'Contact message updated successfully',
    contact_message: updatedMessage
  });
}));

// Get contact message by ID (admin only)
router.get('/:id', catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data: message, error } = await supabase
    .from('contact_messages')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !message) {
    throw new AppError('Contact message not found', 404);
  }

  res.json({ message });
}));

// Get contact statistics (admin only)
router.get('/stats/overview', catchAsync(async (req, res) => {
  const { data: stats } = await supabase
    .from('contact_messages')
    .select('status, message_type, priority, created_at');

  const overview = {
    total: stats.length,
    by_status: {},
    by_type: {},
    by_priority: {},
    recent: stats.filter(msg => 
      new Date(msg.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length
  };

  stats.forEach(msg => {
    overview.by_status[msg.status] = (overview.by_status[msg.status] || 0) + 1;
    overview.by_type[msg.message_type] = (overview.by_type[msg.message_type] || 0) + 1;
    overview.by_priority[msg.priority] = (overview.by_priority[msg.priority] || 0) + 1;
  });

  res.json({ overview });
}));

module.exports = router;