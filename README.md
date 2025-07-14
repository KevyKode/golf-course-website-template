# Your Golf Course Name - Website Template

A professional, modern golf course website template with full booking capabilities, membership management, and payment processing. Designed for easy customization and deployment.

## 🌐 Live Demo

**Website URL:** [Your Live Demo URL Here - e.g., from Railway or Cloudflare Pages]

## 🏌️ Features

### Frontend Features
- **Modern Responsive Design** - Beautiful, mobile-first design with golf course theming
- **Interactive Tee Time Booking** - Calendar-based booking system with real-time availability
- **Member Priority Booking** - Allows logged-in members to book further in advance
- **Membership Management** - Online membership applications and renewals
- **Event Registration** - Tournament and event signup system
- **User Authentication** - Secure login/registration with OAuth support (Google, Facebook)
- **Contact Forms** - Professional contact system with auto-responses
- **Photo Gallery** - Showcase course beauty with scenic images
- **Pricing Information** - Clear, attractive pricing displays

### Backend Features
- **Secure User Accounts** - Robust authentication and user management
- **Payment Processing** - Full Stripe integration for memberships and bookings
- **Database Management** - Comprehensive PostgreSQL schema with Supabase
- **Admin Dashboard** - Complete course management interface (requires development)
- **Email Notifications** - Automated confirmations and communications
- **API Architecture** - RESTful API with proper validation and error handling

### Technical Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (Supabase)
- **Authentication:** Supabase Auth + Passport.js
- **Payments:** Stripe
- **Email:** SendGrid
- **Hosting:** Railway (recommended)

## 🚀 Quick Setup & Deployment

This template consists of two main parts:
1.  **Frontend:** HTML, CSS, and client-side JavaScript.
2.  **Backend:** Node.js server with API routes and database interaction.

For the template to work fully, **both the frontend and backend must be deployed.**

### 1. Environment Configuration

Copy the `.env.template` file to `.env` in your project's root directory and fill in your API keys:

```bash
cp .env.template .env
```

### 2. Required API Keys

You'll need to obtain the following API keys:

#### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from Settings > API
4. Run the SQL schema from `database/schema.sql` in the SQL editor

#### Stripe (Payments)
1. Create account at [stripe.com](https://stripe.com)
2. Get your publishable and secret keys from the dashboard
3. Set up webhook endpoints for payment processing

#### Railway (Hosting)
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy with environment variables

#### SendGrid (Email)
1. Create account at [sendgrid.com](https://sendgrid.com)
2. Verify your sender identity
3. Get your API key from Settings > API Keys

#### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Configure authorized redirect URIs

### 3. Database Setup

1. Create a Supabase project
2. Run the schema from `database/schema.sql`
3. Enable Row Level Security (RLS)
4. Configure authentication providers

### 4. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The website will be available at http://localhost:3000
```

### 5. Production Deployment

For full functionality, you need to deploy both your backend and frontend.

#### Option A: Deploying the Entire Project to Railway (Recommended for simplicity)
This is the easiest way to deploy both your frontend and backend together. Railway will run your `server.js` which serves both your static files and handles API requests.

1.  **Connect to Railway:**
    *   Go to [railway.app](https://railway.app)
    *   Sign up/login with GitHub.
    *   Click "New Project" and select "Deploy from GitHub repo".
    *   Choose your repository.
2.  **Configure Environment Variables:**
    *   In your Railway project dashboard, go to the "Variables" tab.
    *   Add all the environment variables from your `.env` file (Supabase keys, Stripe keys, SendGrid keys, JWT_SECRET, SESSION_SECRET, etc.).
3.  **Deploy:**
    *   Railway will automatically detect your `start` script (`node server.js`) and deploy your application.
    *   Your entire application (frontend and backend) will be accessible at the Railway-provided URL (e.g., `your-project-name.up.railway.app`).
4.  **Update `API_BASE_URL` (Crucial!):**
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
    *   Commit and push this change to your repository.

#### Option B: Separate Deployments (Frontend on Cloudflare Pages, Backend on Railway/Other)
This option gives you more control but requires managing two deployments.

1.  **Deploy Backend (e.g., to Railway):**
    *   Follow steps 1-3 from "Option A: Deploying the Entire Project to Railway" above.
    *   Note down your deployed Railway backend URL (e.g., `https://your-backend-project.up.railway.app`).
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
    *   Commit and push this change to your repository.
    *   Your Cloudflare Pages frontend will now correctly make API calls to your separately deployed backend.

#### Manual Deployment (for advanced users)
```bash
# Build the project (creates the 'dist' directory)
npm run build

# To run the production server locally (for testing before deployment)
npm start
# This will serve the 'dist' folder and run the API.
```

## 🎨 Customization Guide

This template is designed for easy customization. Here's how you can make it your own:

### 1. Replace Text Content
- **`index.html`**: Open `index.html` and search for `[Your ...]` or `Your Golf Course Name`. Replace these placeholders with your actual course name, address, phone number, email, and other details.
- **Pricing Section**: Update the `$XX` and `$XXX` placeholders in the pricing section with your actual green fees and membership costs.
- **About Section**: Customize the descriptive text about the course to match your unique selling points.

### 2. Replace Images
All images are located in the `assets/images/` directory.
- **Hero Section Background**: The main hero image is set in `assets/css/main.css`. Search for `url('assets/images/placeholder-hero.jpg')` (or similar placeholder image URL) and replace it with the path to your high-resolution hero image.
- **About Section Image**: Replace `assets/images/placeholder-course-1.jpg` in `index.html` with your course's image.
- **Gallery Images**: Replace `assets/images/placeholder-gallery-1.jpg` through `placeholder-gallery-6.jpg` in `index.html` with your own beautiful course photos.
- **Favicon**: Replace `assets/images/favicon.ico` with your course's favicon.

**Tip for Images:** Ensure your replacement images are optimized for web (compressed, appropriate dimensions) to maintain fast loading times. Use high-resolution images for the best visual quality.

### 3. Customize Styling
- **`assets/css/main.css`**: This file contains all the core styling.
    - **Color Scheme**: Modify the CSS variables at the top of the file (`:root {}`) to change the primary, secondary, and accent colors to match your brand.
    - **Fonts**: Update the Google Fonts link in `index.html` and the `font-family` properties in `main.css` to use your preferred typography.
    - **Animations**: Adjust animation timings or types for a different feel.

### 4. Update Social Media Links
- In `index.html`, find the Facebook link in the Contact section and update it to your course's Facebook page or other social media profiles.

### 5. Configure Admin Settings
- After setting up your Supabase database, you can update default values like `course_name`, `green_fee_9_holes`, `member_booking_advance_days`, etc., directly in the `admin_settings` table. This allows for dynamic updates without code changes.

## 📁 Project Structure

```
your-golf-course-template/
├── assets/
│   ├── css/
│   │   └── main.css              # Main stylesheet
│   ├── js/
│   │   └── main.js               # Frontend JavaScript
│   └── images/                   # Placeholder images (replace these!)
├── api/
│   ├── config/
│   │   ├── database.js           # Supabase configuration
│   │   └── passport.js           # OAuth configuration
│   ├── middleware/
│   │   ├── auth.js               # Authentication middleware
│   │   └── errorHandler.js       # Error handling
│   └── routes/
│       ├── auth.js               # Authentication routes
│       ├── bookings.js           # Tee time management
│       ├── memberships.js        # Membership management
│       ├── events.js             # Event management
│       ├── contact.js            # Contact form handling
│       ├── payments.js           # Stripe integration
│       └── admin.js              # Admin dashboard
├── database/
│   └── schema.sql                # Complete database schema
├── index.html                    # Main website file
├── server.js                     # Express server
├── package.json                  # Dependencies and scripts
├── .env.template                 # Environment variables template
└── README.md                     # This file
```

## 🎯 Template Information

### Course Details (Placeholder)
- **Location:** [Your Course Address]
- **Course:** 9-hole, 6,170 yards, Rating 72.2, Slope 113 (Update these values in `admin_settings` table)
- **Features:** Pristine grass greens, strategic water hazards, mature trees

### Pricing Structure (Placeholder)
- **9 Holes:** $XX
- **All Day:** $XX
- **Single Membership:** $XXX/year
- **Family Membership:** $XXX/year
- **Student Membership:** $XX/year
- **Alumni/Special Program:** $XX/year

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/refresh` - Refresh access token

### Bookings
- `GET /api/bookings/availability` - Check tee time availability
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Memberships
- `GET /api/memberships/types` - Get membership types and pricing
- `POST /api/memberships` - Apply for membership
- `GET /api/memberships/my-membership` - Get current membership
- `PUT /api/memberships/:id` - Update membership
- `DELETE /api/memberships/:id` - Cancel membership
- `GET /api/memberships/history` - Get user's membership history

### Events
- `GET /api/events` - Get upcoming events
- `GET /api/events/:id` - Get event details
- `POST /api/events/:id/register` - Register for event
- `DELETE /api/events/:id/register` - Cancel event registration
- `GET /api/events/my-registrations` - Get user's registrations

### Payments
- `POST /api/payments/create-booking-payment` - Create payment for booking
- `POST /api/payments/create-membership-payment` - Create payment for membership
- `POST /api/payments/create-event-payment` - Create payment for event
- `POST /api/payments/webhook` - Stripe webhook handler
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/payment/:payment_intent_id` - Get payment details
- `POST /api/payments/refund` - Request refund (admin only)

### Contact
- `POST /api/contact` - Submit contact form

### Admin (Requires Admin Role)
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/settings` - Get all settings
- `PUT /api/admin/settings/:key` - Update setting
- `POST /api/admin/settings` - Create new setting
- `POST /api/admin/course-conditions` - Update course conditions
- `GET /api/admin/course-conditions` - Get course conditions history
- `GET /api/admin/reports/revenue` - Get revenue reports
- `GET /api/admin/reports/bookings` - Get booking reports
- `GET /api/admin/reports/memberships` - Get membership reports
- `GET /api/admin/export/:type` - Export data (CSV)
- `GET /api/bookings/all` - Get all upcoming bookings
- `GET /api/memberships/all` - Get all memberships
- `PUT /api/memberships/:id/verify` - Verify student/alumni status
- `GET /api/memberships/stats/overview` - Get membership statistics
- `GET /api/contact/` - Get contact messages
- `PUT /api/contact/:id` - Update contact message status
- `GET /api/contact/:id` - Get contact message by ID
- `GET /api/contact/stats/overview` - Get contact statistics
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `GET /api/events/:id/registrations` - Get event registrations

## 🛡️ Security Features

- **Row Level Security (RLS)** - Database-level security
- **JWT Authentication** - Secure token-based auth
- **Input Validation** - Comprehensive request validation
- **Rate Limiting** - API abuse prevention
- **CORS Protection** - Cross-origin request security
- **Helmet.js** - Security headers
- **Password Hashing** - bcrypt password protection

## 📧 Email Templates

The system includes professional email templates for:
- User registration verification
- Password reset
- Booking confirmations
- Membership welcome emails
- Event registration confirmations
- Contact form auto-replies
- Payment receipts

## 🔄 Maintenance

### Regular Tasks
- Monitor course conditions updates
- Review booking analytics
- Process membership renewals
- Update event information
- Backup database regularly

### Monitoring
- Server health checks
- Payment processing status
- Email delivery rates
- User activity analytics

## 📞 Support

For technical support or questions about the template:
- **Email:** [Your Support Email]
- **Phone:** [Your Support Phone]
- **Website:** [Your Support Website]

## 📄 License

This project is a template for golf course websites. You are free to use and modify it for your clients or personal projects.

---

**Built for Premier Golf Experiences**

*Experience championship golf at your course - where tradition meets modern convenience.*