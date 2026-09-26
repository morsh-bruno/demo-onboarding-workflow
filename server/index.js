const express = require('express');
const { simulate } = require('./middleware/simulate');
const { reset } = require('./store');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.post('/__admin/reset', (req, res) => {
  reset();
  res.json({ status: 'reset' });
});

// Every onboarding endpoint honours the `x-simulate-outcome` header.
app.use(simulate);
app.use('/auth', require('./routes/auth'));
app.use('/users/me', require('./routes/users'));
app.use('/workspaces', require('./routes/workspaces'));
app.use('/billing', require('./routes/billing'));
app.use('/onboarding', require('./routes/onboarding'));

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: `${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Onboarding API listening on http://localhost:${port}`));
