const crypto = require('node:crypto');

// Ordered onboarding steps. Each step requires the previous one to be completed.
const STEPS = [
  'signup',
  'verify-email',
  'login',
  'accept-terms',
  'update-profile',
  'set-preferences',
  'enable-2fa',
  'create-workspace',
  'invite-teammates',
  'select-plan',
  'complete-onboarding'
];

const users = new Map(); // userId -> user
const sessions = new Map(); // accessToken -> userId
const workspaces = new Map(); // workspaceId -> workspace

const id = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

function findUserByEmail(email) {
  for (const user of users.values()) {
    if (user.email === email) return user;
  }
  return null;
}

function markStep(user, step) {
  user.onboarding[step] = new Date().toISOString();
}

// Returns the name of the step that must be completed before `step`, or null if prerequisites are met.
function missingPrerequisite(user, step) {
  const index = STEPS.indexOf(step);
  for (let i = 0; i < index; i++) {
    if (!user.onboarding[STEPS[i]]) return STEPS[i];
  }
  return null;
}

function onboardingStatus(user) {
  const completed = STEPS.filter((s) => user.onboarding[s]);
  return {
    completed,
    pending: STEPS.filter((s) => !user.onboarding[s]),
    progress: `${completed.length}/${STEPS.length}`
  };
}

function reset() {
  users.clear();
  sessions.clear();
  workspaces.clear();
}

module.exports = {
  STEPS,
  users,
  sessions,
  workspaces,
  id,
  findUserByEmail,
  markStep,
  missingPrerequisite,
  onboardingStatus,
  reset
};
