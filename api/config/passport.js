// Passport configuration for OAuth authentication
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { supabase } = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return done(error, null);
    }

    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with Google ID
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', profile.id)
        .single();

      if (existingUser) {
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', existingUser.id);

        return done(null, existingUser);
      }

      // Check if user exists with same email
      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', profile.emails[0].value)
        .single();

      if (emailUser) {
        // Link Google account to existing user
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            google_id: profile.id,
            is_verified: true,
            last_login: new Date().toISOString()
          })
          .eq('id', emailUser.id)
          .select()
          .single();

        if (updateError) {
          return done(updateError, null);
        }

        return done(null, updatedUser);
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: profile.emails[0].value,
          first_name: profile.name.givenName || '',
          last_name: profile.name.familyName || '',
          google_id: profile.id,
          is_verified: true,
          last_login: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return done(createError, null);
      }

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with Facebook ID
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('facebook_id', profile.id)
        .single();

      if (existingUser) {
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', existingUser.id);

        return done(null, existingUser);
      }

      // Check if user exists with same email
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      if (email) {
        const { data: emailUser, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (emailUser) {
          // Link Facebook account to existing user
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
              facebook_id: profile.id,
              is_verified: true,
              last_login: new Date().toISOString()
            })
            .eq('id', emailUser.id)
            .select()
            .single();

          if (updateError) {
            return done(updateError, null);
          }

          return done(null, updatedUser);
        }
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: email || '',
          first_name: profile.name.givenName || '',
          last_name: profile.name.familyName || '',
          facebook_id: profile.id,
          is_verified: !!email,
          last_login: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return done(createError, null);
      }

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
}, async (payload, done) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .single();

    if (error) {
      return done(error, false);
    }

    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    return done(error, false);
  }
}));

module.exports = passport;