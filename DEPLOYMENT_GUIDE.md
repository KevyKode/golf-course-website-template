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

## 🛠️ Deployment Instructions

This template consists of two main parts:
1.  **Frontend:** HTML, CSS, and client-side JavaScript.
2.  **Backend:** Node.js server with API routes and database interaction.

For the template to work fully, **both the frontend and backend must be deployed.**

### Option A: Deploying the Entire Project to Railway (Recommended for simplicity)
This is the easiest way to deploy both your frontend and backend together. Railway will run your `server.js` which serves both your static files and handles API requests.

1.  **Prepare Repository:**
    *   Ensure all your code changes are committed and pushed to your GitHub repository.
2.  **Connect to Railway:**
    *   Go to [railway.app](https://railway.app)
    *   Sign up/login with GitHub.
    *   Click "New Project" and select "Deploy from GitHub repo".
    *   Choose your repository.
3.  **Configure Environment Variables:**
    *   In your Railway project dashboard, go to the "Variables" tab.
    *   Add all the environment variables from your `.env` file (Supabase keys, Stripe keys, SendGrid keys, JWT_SECRET, SESSION_SECRET, etc.).
    *   **Crucially, ensure `PRODUCTION_URL` is set to your Railway-provided domain (e.g., `https://your-project-name.up.railway.app`).**
4.  **Deploy:**
    *   Railway will automatically detect your `start` script (`node server.js`) and deploy your application.
    *   Your entire application (frontend and backend) will be accessible at the Railway-provided URL (e.g., `your-project-name.up.railway.app`).
5.  **Update `API_BASE_URL` (Crucial!):**
    *   Once your backend is deployed on Railway, you **MUST** update the `API_BASE_URL` in your frontend JavaScript (`assets/js/main.js`) to point to your deployed Railway backend URL.
    *   Open `assets/js/main.js` and change:
        ```javascript
        const API_BASE_URL = window.location.origin.includes('localhost') 
            ? 'http://localhost:3000/api' 
            : `${window.location.origin}/api`;
        ```
        to:
        ```javascript
        const API_BASE_URL = "https://your-railway-backend-url.up.railway.app/api"; 
        // Replace with your actual Railway URL
        ```
    *   Commit and push this change to your repository. This will trigger a new deployment on Railway.

### Option B: Separate Deployments (Frontend on Cloudflare Pages, Backend on Railway/Other)
This option gives you more control but requires managing two separate deployments.

1.  **Deploy Backend (e.g., to Railway):**
    *   Follow steps 1-4 from "Option A: Deploying the Entire Project to Railway" above to deploy your backend.
    *   Note down your deployed Railway backend URL (e.g., `https://your-backend-project.up.railway.app`). This will be your `API_BASE_URL`.
2.  **Deploy Frontend to Cloudflare Pages:**
    *   Go to [pages.cloudflare.com](https://pages.cloudflare.com)
    *   Connect your GitHub repository.
    *   **Build Settings:**
        *   **Build command:** `npm run build`
        *   **Publish directory:** `dist`
    *   Deploy your frontend.
3.  **Update `API_BASE_URL` (Crucial!):**
    *   Open `assets/js/main.js` and change:
        ```javascript
        const API_BASE_URL = window.location.origin.includes('localhost') 
            ? 'http://localhost:3000/api' 
            : `${window.location.origin}/api`;
        ```
        to:
        ```javascript
        const API_BASE_URL = "https://your-backend-project.up.railway.app/api"; 
        // Replace with your actual deployed backend URL (e.g., from Railway)
        ```
    *   Commit and push this change to your repository. This will trigger a new deployment on Cloudflare Pages.

### Manual Deployment (for advanced users)
```bash
# Build the project (creates the 'dist' directory)
npm run build

# To run the production server locally (for testing before deployment)
npm start
# This will serve the 'dist' folder and run the API.
```

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