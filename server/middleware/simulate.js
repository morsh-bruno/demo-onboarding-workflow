// Reads the `x-simulate-outcome` header and exposes helpers so each route can
// return its own realistic failure response when the client asks for one.
const HEADER = 'x-simulate-outcome';

function simulate(req, res, next) {
  const outcome = (req.get(HEADER) || 'success').toLowerCase();
  if (!['success', 'failure'].includes(outcome)) {
    return res.status(400).json({
      error: 'INVALID_SIMULATION_HEADER',
      message: `${HEADER} must be "success" or "failure"`
    });
  }
  req.shouldFail = outcome === 'failure';
  res.set(HEADER, outcome);
  next();
}

module.exports = { simulate, HEADER };
