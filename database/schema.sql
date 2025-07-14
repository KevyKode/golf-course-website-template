-- Rooks County Golf Course Database Schema
-- This schema is designed for Supabase (PostgreSQL) but can be adapted for other databases

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Stores user account information and authentication data
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    
    -- Authentication providers
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    auth0_id VARCHAR(255) UNIQUE,
    
    -- User preferences
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    marketing_emails BOOLEAN DEFAULT true,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- MEMBERSHIPS TABLE
-- =============================================================================
-- Stores membership information and types
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Membership details
    membership_type VARCHAR(50) NOT NULL CHECK (membership_type IN ('single', 'family', 'student', 'alumni')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
    
    -- Pricing and billing
    annual_fee DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50), -- 'stripe', 'cash', 'check'
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Membership period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    
    -- Cart shed access
    cart_shed_number INTEGER,
    cart_shed_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Family membership details
    family_members JSONB, -- Store family member details for family memberships
    
    -- Student verification
    school_verification BOOLEAN DEFAULT false,
    graduation_year INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- TEE_TIMES TABLE
-- =============================================================================
-- Stores tee time bookings and reservations
CREATE TABLE tee_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Booking details
    booking_date DATE NOT NULL,
    tee_time TIME NOT NULL,
    number_of_players INTEGER NOT NULL CHECK (number_of_players BETWEEN 1 AND 4),
    
    -- Player information
    primary_player_name VARCHAR(200) NOT NULL,
    primary_player_email VARCHAR(255) NOT NULL,
    primary_player_phone VARCHAR(20),
    additional_players JSONB, -- Store additional player details
    
    -- Booking preferences
    cart_rental BOOLEAN DEFAULT false,
    cart_rental_fee DECIMAL(10,2) DEFAULT 0,
    special_requests TEXT,
    
    -- Pricing
    green_fee_type VARCHAR(20) CHECK (green_fee_type IN ('9_holes', 'all_day')),
    total_green_fees DECIMAL(10,2) NOT NULL,
    total_cart_fees DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment information
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    stripe_payment_intent_id VARCHAR(255),
    
    -- Booking status
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'no_show', 'completed')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Weather and course conditions
    weather_conditions JSONB,
    course_conditions TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
-- Stores golf tournaments, events, and special occasions
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('tournament', 'lesson', 'social', 'maintenance', 'special')),
    
    -- Event scheduling
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    registration_deadline DATE,
    
    -- Capacity and pricing
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    member_discount DECIMAL(5,2) DEFAULT 0, -- Percentage discount for members
    
    -- Event status
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    is_public BOOLEAN DEFAULT true,
    requires_membership BOOLEAN DEFAULT false,
    
    -- Event details
    prizes JSONB, -- Store prize information
    rules TEXT,
    contact_person VARCHAR(200),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- EVENT_REGISTRATIONS TABLE
-- =============================================================================
-- Stores event registrations and participant information
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Registration details
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    participant_name VARCHAR(200) NOT NULL,
    participant_email VARCHAR(255) NOT NULL,
    participant_phone VARCHAR(20),
    
    -- Additional participants (for team events)
    team_members JSONB,
    
    -- Payment information
    registration_fee DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    stripe_payment_intent_id VARCHAR(255),
    
    -- Registration status
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended', 'no_show')),
    
    -- Event-specific data
    handicap DECIMAL(4,1),
    special_requirements TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(event_id, user_id)
);

-- =============================================================================
-- COURSE_CONDITIONS TABLE
-- =============================================================================
-- Stores daily course conditions and maintenance information
CREATE TABLE course_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Date and conditions
    condition_date DATE NOT NULL UNIQUE,
    overall_condition VARCHAR(20) CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'closed')),
    
    -- Specific area conditions
    greens_condition VARCHAR(20) CHECK (greens_condition IN ('excellent', 'good', 'fair', 'poor')),
    fairways_condition VARCHAR(20) CHECK (fairways_condition IN ('excellent', 'good', 'fair', 'poor')),
    cart_path_condition VARCHAR(20) CHECK (cart_path_condition IN ('excellent', 'good', 'fair', 'poor')),
    
    -- Weather impact
    weather_impact TEXT,
    temperature_range VARCHAR(50),
    wind_conditions VARCHAR(100),
    precipitation VARCHAR(100),
    
    -- Maintenance activities
    maintenance_activities TEXT,
    areas_under_maintenance JSONB,
    
    -- Course availability
    holes_available INTEGER DEFAULT 9 CHECK (holes_available BETWEEN 0 AND 9),
    cart_availability BOOLEAN DEFAULT true,
    
    -- Notes
    special_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CONTACT_MESSAGES TABLE
-- =============================================================================
-- Stores contact form submissions and customer inquiries
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contact information
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    
    -- Message details
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) CHECK (message_type IN ('tee_time', 'membership', 'events', 'general', 'feedback', 'complaint')),
    
    -- Response tracking
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'responded', 'closed')),
    assigned_to VARCHAR(200),
    response TEXT,
    response_date TIMESTAMP WITH TIME ZONE,
    
    -- Priority
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PAYMENT_TRANSACTIONS TABLE
-- =============================================================================
-- Stores all payment transactions for audit and reconciliation
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('membership', 'tee_time', 'event', 'cart_rental', 'merchandise')),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Payment provider details
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'cash', 'check'
    provider_transaction_id VARCHAR(255),
    provider_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Related records
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    tee_time_id UUID REFERENCES tee_times(id) ON DELETE SET NULL,
    event_registration_id UUID REFERENCES event_registrations(id) ON DELETE SET NULL,
    
    -- Transaction status
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    failure_reason TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- ADMIN_SETTINGS TABLE
-- =============================================================================
-- Stores application configuration and settings
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Setting details
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    
    -- Setting metadata
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT false, -- Whether setting can be accessed by public API
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_facebook_id ON users(facebook_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Memberships table indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_type ON memberships(membership_type);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_memberships_end_date ON memberships(end_date);

-- Tee times table indexes
CREATE INDEX idx_tee_times_user_id ON tee_times(user_id);
CREATE INDEX idx_tee_times_booking_date ON tee_times(booking_date);
CREATE INDEX idx_tee_times_tee_time ON tee_times(tee_time);
CREATE INDEX idx_tee_times_status ON tee_times(status);
CREATE INDEX idx_tee_times_date_time ON tee_times(booking_date, tee_time);

-- Events table indexes
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);

-- Event registrations table indexes
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);

-- Course conditions table indexes
CREATE INDEX idx_course_conditions_date ON course_conditions(condition_date);

-- Contact messages table indexes
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

-- Payment transactions table indexes
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(transaction_type);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_date ON payment_transactions(transaction_date);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tee_times_updated_at BEFORE UPDATE ON tee_times FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_registrations_updated_at BEFORE UPDATE ON event_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_course_conditions_updated_at BEFORE UPDATE ON course_conditions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_messages_updated_at BEFORE UPDATE ON contact_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Memberships policies
CREATE POLICY "Users can view own memberships" ON memberships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memberships" ON memberships FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tee times policies
CREATE POLICY "Users can view own tee times" ON tee_times FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tee times" ON tee_times FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tee times" ON tee_times FOR UPDATE USING (auth.uid() = user_id);

-- Events are publicly viewable
CREATE POLICY "Events are publicly viewable" ON events FOR SELECT USING (is_public = true);

-- Event registrations policies
CREATE POLICY "Users can view own registrations" ON event_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registrations" ON event_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Course conditions are publicly viewable
CREATE POLICY "Course conditions are publicly viewable" ON course_conditions FOR SELECT USING (true);

-- Contact messages policies
CREATE POLICY "Users can insert contact messages" ON contact_messages FOR INSERT WITH CHECK (true);

-- Payment transactions policies
CREATE POLICY "Users can view own transactions" ON payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- Admin settings policies (only public settings are viewable)
CREATE POLICY "Public settings are viewable" ON admin_settings FOR SELECT USING (is_public = true);

-- =============================================================================
-- INITIAL DATA SETUP
-- =============================================================================

-- Insert default admin settings
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, category, is_public) VALUES
('course_name', 'Rooks County Golf Course', 'string', 'Official course name', 'general', true),
('course_address', '1925 Highway 183, Between Stockton and Plainville, KS', 'string', 'Course address', 'general', true),
('course_phone', '(785) 434-5555', 'string', 'Course phone number', 'general', true),
('course_email', 'info@rookscountygolf.com', 'string', 'Course email address', 'general', true),
('green_fee_9_holes', '10.00', 'number', '9-hole green fee', 'pricing', true),
('green_fee_all_day', '15.00', 'number', 'All-day green fee', 'pricing', true),
('membership_single', '250.00', 'number', 'Single adult membership fee', 'pricing', true),
('membership_family', '325.00', 'number', 'Family membership fee', 'pricing', true),
('membership_student', '100.00', 'number', 'Student membership fee', 'pricing', true),
('membership_alumni', '50.00', 'number', 'Alumni membership fee', 'pricing', true),
('cart_rental_fee', '15.00', 'number', 'Golf cart rental fee', 'pricing', true),
('course_rating', '72.2', 'number', 'Course rating', 'course_info', true),
('course_slope', '113', 'number', 'Course slope rating', 'course_info', true),
('course_yardage', '6170', 'number', 'Total course yardage', 'course_info', true),
('number_of_holes', '9', 'number', 'Number of holes', 'course_info', true),
('booking_advance_days', '30', 'number', 'How many days in advance bookings can be made', 'booking', false),
('cancellation_hours', '24', 'number', 'Minimum hours before tee time for cancellation', 'booking', false),
('max_players_per_booking', '4', 'number', 'Maximum players per tee time booking', 'booking', true),
('tee_time_interval', '15', 'number', 'Minutes between tee times', 'booking', false),
('course_open_time', '07:00', 'string', 'Course opening time', 'hours', true),
('course_close_time', '19:00', 'string', 'Course closing time', 'hours', true),
('facebook_url', 'https://www.facebook.com/RCGolfCourse/', 'string', 'Facebook page URL', 'social', true);

-- Insert sample course conditions
INSERT INTO course_conditions (condition_date, overall_condition, greens_condition, fairways_condition, cart_path_condition, holes_available) VALUES
(CURRENT_DATE, 'excellent', 'excellent', 'good', 'excellent', 9);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for active memberships with user details
CREATE VIEW active_memberships AS
SELECT 
    m.*,
    u.first_name,
    u.last_name,
    u.email,
    u.phone
FROM memberships m
JOIN users u ON m.user_id = u.id
WHERE m.status = 'active' AND m.end_date >= CURRENT_DATE;

-- View for upcoming tee times
CREATE VIEW upcoming_tee_times AS
SELECT 
    t.*,
    u.first_name,
    u.last_name,
    u.email
FROM tee_times t
LEFT JOIN users u ON t.user_id = u.id
WHERE t.booking_date >= CURRENT_DATE AND t.status = 'confirmed'
ORDER BY t.booking_date, t.tee_time;

-- View for upcoming events
CREATE VIEW upcoming_events AS
SELECT *
FROM events
WHERE event_date >= CURRENT_DATE AND status = 'upcoming'
ORDER BY event_date, start_time;

-- =============================================================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- =============================================================================

-- Function to check tee time availability
CREATE OR REPLACE FUNCTION check_tee_time_availability(
    p_date DATE,
    p_time TIME
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM tee_times 
        WHERE booking_date = p_date 
        AND tee_time = p_time 
        AND status = 'confirmed'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get available tee times for a date
CREATE OR REPLACE FUNCTION get_available_tee_times(p_date DATE)
RETURNS TABLE(tee_time TIME, is_available BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    WITH time_slots AS (
        SELECT generate_series(
            '07:00'::TIME,
            '18:00'::TIME,
            '15 minutes'::INTERVAL
        )::TIME AS slot_time
    )
    SELECT 
        ts.slot_time,
        NOT EXISTS (
            SELECT 1 FROM tee_times tt 
            WHERE tt.booking_date = p_date 
            AND tt.tee_time = ts.slot_time 
            AND tt.status = 'confirmed'
        ) AS is_available
    FROM time_slots ts
    ORDER BY ts.slot_time;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- BACKUP AND MAINTENANCE
-- =============================================================================

-- Create a function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $$
BEGIN
    -- Delete old contact messages (older than 2 years)
    DELETE FROM contact_messages 
    WHERE created_at < NOW() - INTERVAL '2 years' AND status = 'closed';
    
    -- Delete old course conditions (older than 1 year)
    DELETE FROM course_conditions 
    WHERE condition_date < CURRENT_DATE - INTERVAL '1 year';
    
    -- Archive old tee times (older than 1 year)
    -- In a real implementation, you might move these to an archive table
    UPDATE tee_times 
    SET status = 'archived' 
    WHERE booking_date < CURRENT_DATE - INTERVAL '1 year' 
    AND status IN ('completed', 'no_show');
    
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE users IS 'Stores user account information and authentication data';
COMMENT ON TABLE memberships IS 'Stores golf course membership information and billing details';
COMMENT ON TABLE tee_times IS 'Stores tee time bookings and reservations';
COMMENT ON TABLE events IS 'Stores golf tournaments, events, and special occasions';
COMMENT ON TABLE event_registrations IS 'Stores event registrations and participant information';
COMMENT ON TABLE course_conditions IS 'Stores daily course conditions and maintenance information';
COMMENT ON TABLE contact_messages IS 'Stores contact form submissions and customer inquiries';
COMMENT ON TABLE payment_transactions IS 'Stores all payment transactions for audit and reconciliation';
COMMENT ON TABLE admin_settings IS 'Stores application configuration and settings';

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================