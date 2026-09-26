const express = require('express');
const { workspaces, id, markStep, onboardingStatus } = require('../store');
const { requireAuth } = require('../middleware/auth');
const { step } = require('../middleware/steps');

const router = express.Router();
router.use(requireAuth);

const MAX_INVITES = 10;

router.post(
  '/',
  step(
    'create-workspace',
    { status: 409, error: 'WORKSPACE_SLUG_TAKEN', message: 'A workspace with this slug already exists' },
    (req, res, next, user) => {
      const { name, slug } = req.body || {};
      if (!name || !slug) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'name and slug are required' });
      }
      if ([...workspaces.values()].some((w) => w.slug === slug)) {
        return res.status(409).json({ error: 'WORKSPACE_SLUG_TAKEN', message: 'A workspace with this slug already exists' });
      }
      const workspace = { id: id('ws'), name, slug, ownerId: user.id, members: [user.email], invites: [] };
      workspaces.set(workspace.id, workspace);
      user.workspaceId = workspace.id;
      markStep(user, 'create-workspace');
      res.status(201).json({ workspaceId: workspace.id, name, slug, onboarding: onboardingStatus(user) });
    }
  )
);

router.post(
  '/:workspaceId/invites',
  step(
    'invite-teammates',
    { status: 429, error: 'INVITE_LIMIT_REACHED', message: 'Invite limit reached for this workspace' },
    (req, res, next, user) => {
      const workspace = workspaces.get(req.params.workspaceId);
      if (!workspace || workspace.ownerId !== user.id) {
        return res.status(404).json({ error: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' });
      }
      const emails = req.body.emails || [];
      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(422).json({ error: 'VALIDATION_ERROR', message: 'emails must be a non-empty array' });
      }
      if (workspace.invites.length + emails.length > MAX_INVITES) {
        return res.status(429).json({ error: 'INVITE_LIMIT_REACHED', message: `Max ${MAX_INVITES} invites per workspace` });
      }
      const invited = emails.map((email) => ({ email, role: req.body.role || 'member', status: 'pending' }));
      workspace.invites.push(...invited);
      markStep(user, 'invite-teammates');
      res.status(201).json({ workspaceId: workspace.id, invited, onboarding: onboardingStatus(user) });
    }
  )
);

module.exports = router;
