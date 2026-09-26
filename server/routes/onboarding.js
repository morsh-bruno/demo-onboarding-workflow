const express = require('express');
const { markStep, onboardingStatus } = require('../store');
const { requireAuth } = require('../middleware/auth');
const { step } = require('../middleware/steps');

const router = express.Router();
router.use(requireAuth);

router.get('/status', (req, res) => {
  res.json({ userId: req.user.id, ...onboardingStatus(req.user) });
});

router.post(
  '/complete',
  step(
    'complete-onboarding',
    { status: 500, error: 'ONBOARDING_FINALIZE_FAILED', message: 'Could not finalize onboarding, please retry' },
    (req, res, next, user) => {
      markStep(user, 'complete-onboarding');
      res.json({
        userId: user.id,
        status: 'completed',
        completedAt: user.onboarding['complete-onboarding'],
        summary: {
          email: user.email,
          displayName: user.profile.displayName,
          termsVersion: user.terms.version,
          twoFactor: user.twoFactor.enabled,
          workspaceId: user.workspaceId,
          plan: user.subscription.plan
        },
        onboarding: onboardingStatus(user)
      });
    }
  )
);

module.exports = router;
