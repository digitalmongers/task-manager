import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import AuthRepository from '../repositories/authRepository.js';
import Logger from './logger.js';

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await AuthRepository.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        Logger.info('Google OAuth callback triggered', {
          profileId: profile.id,
          email: profile.emails?.[0]?.value,
        });

        // Extract user data from Google profile
        const email = profile.emails?.[0]?.value;
        const firstName = profile.name?.givenName || '';
        const lastName = profile.name?.familyName || '';
        const googleId = profile.id;
        const googlePhoto = profile.photos?.[0]?.value || null;
        const isEmailVerified = profile.emails?.[0]?.verified || false;

        if (!email) {
          Logger.error('Google OAuth: No email provided');
          return done(new Error('Email not provided by Google'), null);
        }

        // Check if user exists
        let user = await AuthRepository.findByEmail(email);

        if (user) {
          // User exists - link Google account if not already linked
          if (!user.googleId) {
            user = await AuthRepository.linkGoogleAccount(user._id, {
              googleId,
              googlePhoto,
            });

            Logger.logAuth('GOOGLE_ACCOUNT_LINKED', user._id, {
              email: user.email,
              googleId,
              ip: req.ip,
            });
          }

          // Update last login
          await AuthRepository.updateLastLogin(user._id);

          Logger.logAuth('GOOGLE_LOGIN_SUCCESS', user._id, {
            email: user.email,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });

          return done(null, user);
        }

        // User doesn't exist - create new user
        user = await AuthRepository.createGoogleUser({
          firstName,
          lastName,
          email,
          googleId,
          isEmailVerified,
          googlePhoto,
          termsAccepted: true, // Assumed accepted via Google OAuth
          termsAcceptedAt: new Date(),
        });

        Logger.logAuth('GOOGLE_USER_CREATED', user._id, {
          email: user.email,
          googleId,
          ip: req.ip,
        });

        return done(null, user);
      } catch (error) {
        Logger.error('Google OAuth error', {
          error: error.message,
          stack: error.stack,
        });
        return done(error, null);
      }
    }
  )
);

export default passport;