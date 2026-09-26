const { sessions, users } = require('../store');

function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  const userId = scheme === 'Bearer' && sessions.get(token);
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid access token' });
  }
  req.user = users.get(userId);
  next();
}

module.exports = { requireAuth };
