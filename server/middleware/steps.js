const { missingPrerequisite } = require('../store');

// Wraps an onboarding step: enforces step ordering, then the simulated failure, then the handler.
// `failure` is the realistic error this step returns when `x-simulate-outcome: failure` is sent.
// `resolveUser` finds the user for steps that run before login (defaults to the authenticated user).
function step(name, failure, handler, { resolveUser = (req) => req.user } = {}) {
  return (req, res, next) => {
    const user = resolveUser(req);
    if (user) {
      const missing = missingPrerequisite(user, name);
      if (missing) {
        return res.status(409).json({
          error: 'STEP_OUT_OF_ORDER',
          message: `Step "${name}" requires "${missing}" to be completed first`,
          step: name
        });
      }
    }
    if (req.shouldFail) {
      return res.status(failure.status).json({
        error: failure.error,
        message: failure.message,
        step: name,
        simulated: true
      });
    }
    return handler(req, res, next, user);
  };
}

module.exports = { step };
