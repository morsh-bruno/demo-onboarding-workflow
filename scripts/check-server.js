// Runs before each test script: fail fast with a clear message if the API is not running.
// Without this, the Bruno CLI reports every request as failed without saying why.
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

fetch(`${baseUrl}/health`)
  .then((res) => {
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  })
  .catch((err) => {
    console.error(`\n✗ Onboarding API is not reachable at ${baseUrl} (${err.cause?.code || err.message}).`);
    console.error('  Start it in another terminal with: npm start (or, for the mock collection, start the mock server in the Bruno app)\n');
    process.exit(1);
  });
