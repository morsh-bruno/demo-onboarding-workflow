const express = require('express');
const crypto = require('node:crypto');
const { users, sessions, id, findUserByEmail, markStep, onboardingStatus } = require('../store');
const { step } = require('../middleware/steps');

const router = express.Router();
const hash = (password) => crypto.createHash('sha256').update(password).digest('hex');

router.post(
  '/signup',
  step(
    'signup',
    { status: 409, error: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' },
    (req, res) => {
      const { email, password, name } = req.body || {};
      if (!email || !password || !name) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'email, password and name are required' });
      }
      if (findUserByEmail(email)) {
        return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' });
      }
      const user = {
        id: id('usr'),
        email,
        name,
        passwordHash: hash(password),
        otp: String(crypto.randomInt(100000, 1000000)),
        emailVerified: false,
        profile: {},
        preferences: {},
        onboarding: {}
      };
      users.set(user.id, user);
      markStep(user, 'signup');
      res.status(201).json({
        userId: user.id,
        email: user.email,
        message: 'Account created. A verification code was sent to your email.',
        // Demo only: a real system would never return the OTP.
        debugOtp: user.otp,
        onboarding: onboardingStatus(user)
      });
    }
  )
);

router.post(
  '/verify-email',
  step(
    'verify-email',
    { status: 400, error: 'INVALID_OTP', message: 'The verification code is invalid or has expired' },
    (req, res, next, user) => {
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Unknown userId' });
      if (req.body.otp !== user.otp) {
        return res.status(400).json({ error: 'INVALID_OTP', message: 'The verification code is invalid or has expired' });
      }
      user.emailVerified = true;
      markStep(user, 'verify-email');
      res.json({ userId: user.id, emailVerified: true, onboarding: onboardingStatus(user) });
    },
    { resolveUser: (req) => users.get(req.body?.userId) }
  )
);

router.post(
  '/login',
  step(
    'login',
    { status: 401, error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' },
    (req, res, next, user) => {
      if (!user || user.passwordHash !== hash(req.body.password || '')) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
      }
      const accessToken = crypto.randomUUID();
      sessions.set(accessToken, user.id);
      markStep(user, 'login');
      res.json({ accessToken, tokenType: 'Bearer', expiresIn: 3600, onboarding: onboardingStatus(user) });
    },
    { resolveUser: (req) => findUserByEmail(req.body?.email) }
  )
);

module.exports = router;
