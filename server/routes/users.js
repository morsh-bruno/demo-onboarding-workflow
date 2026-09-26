const express = require('express');
const crypto = require('node:crypto');
const { markStep, onboardingStatus } = require('../store');
const { requireAuth } = require('../middleware/auth');
const { step } = require('../middleware/steps');

const router = express.Router();
router.use(requireAuth);

const CURRENT_TERMS_VERSION = '2026-01';
const SUPPORTED_LOCALES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'hi-IN'];

router.post(
  '/terms',
  step(
    'accept-terms',
    { status: 422, error: 'TERMS_VERSION_OUTDATED', message: `Terms version must be ${CURRENT_TERMS_VERSION}` },
    (req, res, next, user) => {
      if (req.body.version !== CURRENT_TERMS_VERSION) {
        return res.status(422).json({ error: 'TERMS_VERSION_OUTDATED', message: `Terms version must be ${CURRENT_TERMS_VERSION}` });
      }
      user.terms = { version: req.body.version, acceptedAt: new Date().toISOString() };
      markStep(user, 'accept-terms');
      res.json({ ...user.terms, onboarding: onboardingStatus(user) });
    }
  )
);

router.patch(
  '/profile',
  step(
    'update-profile',
    { status: 422, error: 'VALIDATION_ERROR', message: 'Profile contains invalid fields' },
    (req, res, next, user) => {
      const { displayName, jobTitle, company, bio } = req.body || {};
      if (!displayName) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'displayName is required' });
      }
      user.profile = { ...user.profile, displayName, jobTitle, company, bio };
      markStep(user, 'update-profile');
      res.json({ profile: user.profile, onboarding: onboardingStatus(user) });
    }
  )
);

router.put(
  '/preferences',
  step(
    'set-preferences',
    { status: 422, error: 'UNSUPPORTED_LOCALE', message: 'The requested locale is not supported' },
    (req, res, next, user) => {
      const { locale = 'en-US', timezone = 'UTC', notifications = {} } = req.body || {};
      if (!SUPPORTED_LOCALES.includes(locale)) {
        return res.status(422).json({ error: 'UNSUPPORTED_LOCALE', message: `Supported locales: ${SUPPORTED_LOCALES.join(', ')}` });
      }
      user.preferences = { locale, timezone, notifications };
      markStep(user, 'set-preferences');
      res.json({ preferences: user.preferences, onboarding: onboardingStatus(user) });
    }
  )
);

router.post(
  '/2fa',
  step(
    'enable-2fa',
    { status: 400, error: '2FA_SETUP_FAILED', message: 'Could not set up two-factor authentication' },
    (req, res, next, user) => {
      const method = req.body.method || 'totp';
      user.twoFactor = { enabled: true, method };
      markStep(user, 'enable-2fa');
      res.json({
        enabled: true,
        method,
        secret: crypto.randomBytes(10).toString('hex').toUpperCase(),
        backupCodes: Array.from({ length: 5 }, () => crypto.randomBytes(4).toString('hex')),
        onboarding: onboardingStatus(user)
      });
    }
  )
);

module.exports = router;
