# Your Golf Course Name - Deployment Guide

This guide will walk you through deploying the Your Golf Course Name website template to production.

## 🚀 Deployment Options

### Option 1: Railway (Recommended)
Railway provides the easiest deployment with automatic scaling and built-in PostgreSQL.

### Option 2: Vercel + Supabase
Great for static frontend with serverless functions.

### Option 3: Traditional VPS
Full control with services like DigitalOcean, Linode, or AWS EC2.

## 📋 Pre-Deployment Checklist

### 1. API Keys Required
- [ ] Supabase project URL and keys
- [ ] Stripe publishable and secret keys
- [ ] SendGrid API key and verified sender
- [ ] Google OAuth credentials (optional)
- [ ] Facebook OAuth credentials (optional)

### 2. Domain Setup
- [ ] Purchase domain name (e.g., yourgolfcourse.com)
- [ ] Configure DNS settings
- [ ] SSL certificate (automatic with most hosts)

### 3. Email Configuration
- [ ] Verify sender identity with SendGrid
- [ ] Create email templates
- [ ] Test email delivery

## 🛠️ Railway Deployment (Step-by-Step)

### Step 1: Prepare Repository
```bash
# Clone or fork the repository
git clone <your-repo-url>
cd your-golf-course-template

# Ensure all files are committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### Step 3: Configure Environment Variables
In Railway dashboard, go to Variables tab and add:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Payments
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourgolfcourse.com
SENDGRID_FROM_NAME=Your Golf Course Name

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_32_chars_min
SESSION_SECRET=your_session_secret_32_chars_min

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Application
NODE_ENV=production
PORT=3000
PRODUCTION_URL=https://your-domain.com

# Admin Settings (Optional, can be set in Supabase admin_settings table)
# These are default values that can be overridden in the database
# COURSE_NAME=Your Golf Course Name
# COURSE_ADDRESS=Your Course Address Line 1, Your Course Address Line 2, State ZIP
# COURSE_PHONE=(XXX) XXX-XXXX
# COURSE_EMAIL=info@yourgolfcourse.com
# GREEN_FEE_9_HOLES=10.00
# GREEN_FEE_ALL_DAY=15.00
# MEMBERSHIP_SINGLE=250.00
# MEMBERSHIP_FAMILY=325.00
# MEMBERSHIP_STUDENT=100.00
# MEMBERSHIP_ALUMNI=50.00
# CART_RENTAL_FEE=15.00
# MEMBER_BOOKING_ADVANCE_DAYS=60
# COURSE_RATING=72.2
# COURSE_SLOPE=113
# COURSE_YARDAGE=6170
# NUMBER_OF_HOLES=9
# BOOKING_ADVANCE_DAYS=30
# CANCELLATION_HOURS=24
# MAX_PLAYERS_PER_BOOKING=4
# TEE_TIME_INTERVAL=15
# COURSE_OPEN_TIME=07:00
# COURSE_CLOSE_TIME=19:00
# FACEBOOK_URL=https://www.facebook.com/YourGolfCoursePage/
```

### Step 4: Configure Custom Domain
1. In Railway dashboard, go to Settings
2. Click "Custom Domain"
3. Add your domain (e.g., yourgolfcourse.com)
4. Update DNS records as instructed

### Step 5: Deploy
Railway will automatically deploy when you push to main branch.

## 🗄️ Database Setup (Supabase)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose a strong password
4. Wait for project to initialize

### Step 2: Run Database Schema
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `database/schema.sql`
3. Run the SQL script
4. Verify tables are created

### Step 3: Configure Authentication
1. Go to Authentication > Settings
2. Enable email confirmations
3. Configure OAuth providers (Google, Facebook)
4. Set up redirect URLs

### Step 4: Set Row Level Security
RLS is automatically configured in the schema, but verify:
1. Go to Authentication > Policies
2. Ensure policies are active
3. Test with a test user account

### Step 5: Populate Admin Settings
After running the schema, the `admin_settings` table will have default values. You can update these directly in the Supabase table editor to customize:
- `course_name`
- `course_address`, `course_phone`, `course_email`
- `green_fee_9_holes`, `green_fee_all_day`, `cart_rental_fee`
- `membership_single`, `membership_family`, `membership_student`, `membership_alumni`
- `member_booking_advance_days` (for member priority booking)
- `course_rating`, `course_slope`, `course_yardage`, `number_of_holes`
- `course_open_time`, `course_close_time`, `tee_time_interval`
- `facebook_url` and other social links

## 💳 Stripe Configuration

### Step 1: Account Setup
1. Create Stripe account
2. Complete business verification
3. Switch to live mode for production

### Step 2: Create Products
Create products for each membership type:
```
Single Adult Membership - $XXX/year
Family Membership - $XXX/year
Student Membership - $XX/year
Alumni/Special Program - $XX/year
```

### Step 3: Webhook Configuration
1. Go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
4. Copy webhook secret to environment variables

## 📧 Email Setup (SendGrid)

### Step 1: Account Verification
1. Create SendGrid account
2. Verify your email address
3. Complete sender authentication

### Step 2: Domain Authentication
1. Go to Settings > Sender Authentication
2. Authenticate your domain
3. Add DNS records as instructed

### Step 3: API Key Creation
1. Go to Settings > API Keys
2. Create new API key with full access
3. Copy key to environment variables

## 🔒 Security Configuration

### SSL Certificate
- Railway provides automatic SSL
- Verify HTTPS is working
- Set up HTTP to HTTPS redirects

### Environment Variables
- Never commit `.env` files
- Use strong, unique secrets
- Rotate keys regularly

### Database Security
- Enable Row Level Security
- Use service role key only for admin operations
- Monitor access logs

## 🧪 Testing Deployment

### Step 1: Functionality Tests
- [ ] Website loads correctly
- [ ] User registration works
- [ ] Login/logout functions
- [ ] Booking system operates
- [ ] Payment processing works
- [ ] Emails are delivered
- [ ] Contact form submits

### Step 2: Performance Tests
- [ ] Page load times < 3 seconds
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility
- [ ] API response times

### Step 3: Security Tests
- [ ] HTTPS enforced
- [ ] Authentication required for protected routes
- [ ] Input validation working
- [ ] Rate limiting active

## 📊 Monitoring Setup

### Application Monitoring
Consider adding:
- Sentry for error tracking
- Google Analytics for user behavior
- Uptime monitoring (UptimeRobot)

### Database Monitoring
- Supabase provides built-in monitoring
- Set up alerts for high usage
- Monitor query performance

## 🔄 Maintenance Tasks

### Daily
- Check error logs
- Monitor payment processing
- Review new contact messages

### Weekly
- Update course conditions
- Review booking analytics
- Check email delivery rates

### Monthly
- Database backup verification
- Security updates
- Performance optimization

## 🆘 Troubleshooting

### Common Issues

**Website not loading:**
- Check Railway deployment logs
- Verify environment variables
- Check domain DNS settings

**Database connection errors:**
- Verify Supabase URL and keys
- Check network connectivity
- Review RLS policies

**Payment failures:**
- Check Stripe webhook configuration
- Verify API keys are live mode
- Review Stripe dashboard for errors

**Email not sending:**
- Verify SendGrid API key
- Check sender authentication
- Review email templates

### Getting Help
1. Check Railway/Supabase documentation
2. Review application logs
3. Contact support if needed

## 📞 Support Contacts

- **Railway Support:** [railway.app/help](https://railway.app/help)
- **Supabase Support:** [supabase.com/support](https://supabase.com/support)
- **Stripe Support:** [stripe.com/support](https://stripe.com/support)
- **SendGrid Support:** [sendgrid.com/support](https://sendgrid.com/support)

---

**🎉 Congratulations!** Your Golf Course Website Template is now ready for deployment and customization!