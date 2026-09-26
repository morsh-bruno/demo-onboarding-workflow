const express = require('express');
const { id, markStep, onboardingStatus } = require('../store');
const { requireAuth } = require('../middleware/auth');
const { step } = require('../middleware/steps');

const router = express.Router();
router.use(requireAuth);

const PLANS = { free: 0, pro: 12, business: 29 };

router.post(
  '/subscription',
  step(
    'select-plan',
    { status: 402, error: 'PAYMENT_DECLINED', message: 'The payment method was declined' },
    (req, res, next, user) => {
      const { plan, paymentMethodId } = req.body || {};
      if (!(plan in PLANS)) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: `plan must be one of: ${Object.keys(PLANS).join(', ')}` });
      }
      if (PLANS[plan] > 0 && !paymentMethodId) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'paymentMethodId is required for paid plans' });
      }
      user.subscription = { id: id('sub'), plan, pricePerMonth: PLANS[plan], status: 'active' };
      markStep(user, 'select-plan');
      res.status(201).json({ subscriptionId: user.subscription.id, ...user.subscription, onboarding: onboardingStatus(user) });
    }
  )
);

module.exports = router;
