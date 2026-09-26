# Testing a user onboarding workflow with Bruno

This demo shows how to test a multi-step, stateful workflow with [Bruno](https://www.usebruno.com/): an 11-step user onboarding flow served by a small Express API.

The collection runs in three scenarios:

| Scenario | Environment | What happens |
|---|---|---|
| Happy path | `success` | All 11 steps pass. |
| Failure at the last step | `fail-last-step` | Steps 1–10 pass; step 11 fails and is reported. |
| Failure at the OTP step | `fail-otp` | Step 2 fails; the run stops and steps 3–11 never run. |

## The workflow

| # | Step (`step` var) | Endpoint | Simulated failure |
|---|---|---|---|
| 1 | `signup` | `POST /auth/signup` | 409 `EMAIL_ALREADY_EXISTS` |
| 2 | `verify-email` | `POST /auth/verify-email` | 400 `INVALID_OTP` |
| 3 | `login` | `POST /auth/login` | 401 `INVALID_CREDENTIALS` |
| 4 | `accept-terms` | `POST /users/me/terms` | 422 `TERMS_VERSION_OUTDATED` |
| 5 | `update-profile` | `PATCH /users/me/profile` | 422 `VALIDATION_ERROR` |
| 6 | `set-preferences` | `PUT /users/me/preferences` | 422 `UNSUPPORTED_LOCALE` |
| 7 | `enable-2fa` | `POST /users/me/2fa` | 400 `2FA_SETUP_FAILED` |
| 8 | `create-workspace` | `POST /workspaces` | 409 `WORKSPACE_SLUG_TAKEN` |
| 9 | `invite-teammates` | `POST /workspaces/:id/invites` | 429 `INVITE_LIMIT_REACHED` |
| 10 | `select-plan` | `POST /billing/subscription` | 402 `PAYMENT_DECLINED` |
| 11 | `complete-onboarding` | `POST /onboarding/complete` | 500 `ONBOARDING_FINALIZE_FAILED` |

The server enforces the order: calling a step before the one it depends on returns `409 STEP_OUT_OF_ORDER`. Data flows between steps through Bruno runtime variables (`userId`, `otp`, `accessToken`, `workspaceId`).

Helper endpoints: `GET /health`, `GET /onboarding/status` (authenticated), `POST /__admin/reset`.

## How failures are simulated

Every endpoint reads the `x-simulate-outcome` header:

- `success` (or no header): the endpoint behaves normally.
- `failure`: the endpoint returns its realistic error from the table above.

Bruno sets this header in the **collection-level pre-request script** in [bruno/opencollection.yml](bruno/opencollection.yml), which runs before every request:

```js
const step = bru.getRequestVar("step");       // declared in each request file
const failAtStep = bru.getEnvVar("failAtStep"); // declared in each environment
const outcome = step && step === failAtStep ? "failure" : "success";

bru.setVar("simulateOutcome", outcome);
req.setHeader("x-simulate-outcome", outcome);
```

The collection-level tests script then:

1. Adds a `step "<name>" succeeded` test that fails with the server's error code, e.g. `INVALID_OTP: The verification code is invalid or has expired`.
2. Calls `bru.runner.stopExecution()` when a step fails, because the remaining steps depend on it.

Each request also has its own tests asserting the success response. The tests always expect success, so a failing step shows up **red** in the report and the CLI exits with code 1, just as a real regression would in CI.

## Running it

Requirements: Node.js 18+, and the Bruno app 3.1+ if you want to use the GUI (the collection uses the YAML / OpenCollection format).

```bash
npm install
npm start                 # API on http://localhost:3000
```

### Bruno app

1. Open the `bruno/` folder as a collection.
2. Pick an environment: `success`, `fail-last-step` or `fail-otp`.
3. Right-click the `user-onboarding` folder → **Run**.

### Bruno CLI

In a second terminal:

```bash
npm run test:success      # all steps pass
npm run test:fail-last    # step 11 fails
npm run test:fail-otp     # step 2 fails, run stops
npm run test:all          # all three + the data-driven run
```

HTML reports are written to `reports/`.

Each test script first checks `GET /health` and stops with a clear message if the API isn't running. Otherwise the Bruno CLI would report every request as failed without saying why.

Make any other step fail by overriding the variable:

```bash
cd bruno
npx bru run user-onboarding --env success --env-var failAtStep=select-plan
```

## Data-driven run: 10 users from a CSV

The second collection, [bruno-data-driven/](bruno-data-driven/), runs the same 11-step workflow once per row of [bruno-data-driven/data/users.csv](bruno-data-driven/data/users.csv). Each row is one user with their own name, profile, locale, plan and `failAtStep`:

| User | `failAtStep` | Expected result |
|---|---|---|
| user-03 | `verify-email` | fails at the OTP step; steps 3–11 skipped |
| user-06 | `select-plan` | fails at payment; step 11 skipped |
| user-09 | `complete-onboarding` | fails at the last step |
| the other 7 | `none` | all 11 steps pass |

```bash
npm run test:data-driven
```

The CLI prints one row per user in its iteration summary table and writes `reports/data-driven.html`.

How it differs from the basic collection:

- **CSV values in requests:** request bodies use the CSV columns directly, e.g. `"plan": "{{plan}}"`. Scripts read them with `bru.runner.iterationData.get("plan")`. `bru.interpolate()` does not resolve CSV columns.
- **Which step fails:** the collection pre-request script reads `failAtStep` from the current CSV row, falling back to the environment when a request is run on its own.
- **Failures don't stop the run:** instead of `bru.runner.stopExecution()`, a failed step sets a `workflowFailedAt` runtime variable. The pre-request script then calls `bru.runner.skipRequest()` for that user's remaining steps, and clears the flag at the next user's `signup`. The failing user shows as failed with skipped steps, and the next user carries on.

In the Bruno app: open `bruno-data-driven/` as a collection, select the `local` environment, run the `onboard-user` folder, and choose `data/users.csv` as the data file in the Runner.

## Mock server: the same workflow without the backend

[bruno-mock/](bruno-mock/) runs the same 11-step workflow against a **Bruno mock server** instead of the Express API. This is useful when the backend isn't built yet or isn't available: frontend and QA can still exercise the full flow, including failures.

The mock server is a Bruno desktop app feature (Bruno 4.x, currently in beta; toggle under Preferences > Beta). It is **not** available in the CLI.

### How it fits together

- **The workspace:** [workspace.yml](workspace.yml) makes this project a Bruno workspace containing all three collections.
- **The mock server:** workspace mock servers live in `mocks/`. [mocks/onboarding-api-mock.yml](mocks/onboarding-api-mock.yml) defines the "Onboarding API Mock" on port 4000, with a 150 ms response delay.
- **Two routes per endpoint:**
  - A **Success** route with no rules. It's the default.
  - A **Failure** route with one rule: header `x-simulate-outcome` equals `failure`.
- **Same header as the real server:** the collection's pre-request script sets `x-simulate-outcome` exactly as before, so choosing which step fails works identically against the mock and the real server.
- **Examples on every request:** each request in `bruno-mock/` carries `Success` and `Failure` response examples. They document the API contract, and they are what the app's "Sync with Examples" uses to build mock routes.
- **Environments:** `mock-success`, `mock-fail-last-step` and `mock-fail-otp` point `baseUrl` at `http://localhost:4000`.

The mock is stateless and returns canned data: OTP `123456`, user `usr_mock00000001`, workspace `ws_mock00000001`. Step ordering (`409 STEP_OUT_OF_ORDER`) is therefore not enforced, and the signup request uses a fixed email.

### Running it

1. Open **this project folder** in Bruno as a workspace (**Open Workspace**, then select `demo-qa-workflow/`). Mock servers belong to a workspace. If you add the collections to a different workspace, the provided mock server won't show up there.
2. Under **Mock Servers**, select **Onboarding API Mock** and click **Start Server**.
3. Open the **User Onboarding (Mock Server)** collection, pick a `mock-*` environment, and run the `user-onboarding` folder.

While the mock server is running in the app, the CLI can also run the collection against it:

```bash
npm run test:mock-success     # all 11 steps pass
npm run test:mock-fail-last   # step 11 fails
npm run test:mock-fail-otp    # step 2 fails, run stops
```

If you create a mock server in the app from the `bruno-mock` collection, or use **Sync with Examples**, instead of using the provided file, add the `x-simulate-outcome equals failure` rule to each Failure route. Without it, the first route for an endpoint is always returned.

## Project layout

```
server/
  index.js                 Express app
  store.js                 in-memory users, sessions, workspaces; step order
  middleware/simulate.js   reads x-simulate-outcome
  middleware/steps.js      step ordering + simulated failure wrapper
  middleware/auth.js       bearer token check
  routes/                  auth, users, workspaces, billing, onboarding
bruno/
  opencollection.yml       collection scripts (header + stop on failure)
  environments/            success, fail-last-step, fail-otp
  user-onboarding/         the 11 requests (01-signup.yml … 11-complete-onboarding.yml)
bruno-data-driven/
  opencollection.yml       per-user failure selection + skip-on-failure
  data/users.csv           10 users, 3 of them set to fail
  environments/local.yml
  onboard-user/            the same 11 requests, parameterised by CSV columns
bruno-mock/
  opencollection.yml       same collection scripts as bruno/
  environments/            mock-success, mock-fail-last-step, mock-fail-otp (port 4000)
  user-onboarding/         the 11 requests, each with Success + Failure examples
mocks/
  onboarding-api-mock.yml  Bruno workspace mock server (success + rule-based failure routes)
workspace.yml              Bruno workspace listing all three collections
```
