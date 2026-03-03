const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  // Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            return done(null, user);
          } else {
            const newUser = new User({
              name: profile.displayName,
              email: profile.emails[0].value,
              avatarUrl: profile.photos[0].value,
              status: 'active'
            });
            await newUser.save();
            return done(null, newUser);
          }
        } catch (err) {
          return done(err, null);
        }
      }
    ));
  }

  // GitHub Strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails ? profile.emails[0].value : `${profile.username}@github.com`;
          let user = await User.findOne({ email });
          if (user) {
            return done(null, user);
          } else {
            const newUser = new User({
              name: profile.displayName || profile.username,
              email: email,
              avatarUrl: profile._json.avatar_url,
              status: 'active'
            });
            await newUser.save();
            return done(null, newUser);
          }
        } catch (err) {
          return done(err, null);
        }
      }
    ));
  }

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
