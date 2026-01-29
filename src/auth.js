import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "./config.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL,
        },
        (accessToken, refreshToken, profile, done) => {
            return done(null, { profile, accessToken, refreshToken });
        }
    )
);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

export default passport;
