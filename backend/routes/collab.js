const router = require('express').Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Membership = require('../models/Membership');
const CollabFile = require('../models/CollabFile');
const CollabVersion = require('../models/CollabVersion');
const ActivityLog = require('../models/ActivityLog');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function ensureMembership(groupId, userId) {
  return Membership.findOne({ group: groupId, user: userId });
}

router.use(auth, rateLimit({ windowMs: 60000, max: 240 }));

router.get('/groups/:groupId/files', async (req, res) => {
  const { groupId } = req.params;
  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const files = await CollabFile.find({ group: groupId }).sort({ updatedAt: -1 });
  return res.json(files);
});

router.post('/groups/:groupId/files', async (req, res) => {
  const { groupId } = req.params;
  const { name, type } = req.body;

  if (!name || !type) return res.status(400).json({ error: 'name and type are required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const initialContent = type === 'spreadsheet' ? { cells: {} } : { text: '' };

  const file = await CollabFile.create({
    group: groupId,
    name: String(name).trim(),
    type,
    content: initialContent,
    createdBy: req.user.id,
    permissions: { approvalRequired: false },
  });

  await CollabVersion.create({
    file: file._id,
    group: groupId,
    version: 1,
    branch: 'main',
    snapshot: initialContent,
    patchSummary: 'Initial version',
    author: req.user.id,
  });

  await ActivityLog.create({
    group: groupId,
    file: file._id,
    user: req.user.id,
    action: 'file_created',
    metadata: { name: file.name, type: file.type },
  });

  return res.status(201).json(file);
});

router.get('/files/:fileId', async (req, res) => {
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  return res.json(file);
});

router.get('/files/:fileId/history', async (req, res) => {
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const versions = await CollabVersion.find({ file: file._id })
    .sort({ version: -1 })
    .limit(100)
    .populate('author', 'name email');
  return res.json(versions);
});

router.post('/files/:fileId/versions', async (req, res) => {
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  file.latestVersion += 1;
  await file.save();

  const version = await CollabVersion.create({
    file: file._id,
    group: file.group,
    version: file.latestVersion,
    branch: req.body.branch || 'main',
    parentVersion: file.latestVersion - 1,
    snapshot: file.content,
    patchSummary: req.body.patchSummary || 'Autosave snapshot',
    author: req.user.id,
  });

  await ActivityLog.create({
    group: file.group,
    file: file._id,
    user: req.user.id,
    action: 'version_created',
    metadata: { version: version.version, branch: version.branch },
  });

  return res.status(201).json(version);
});

router.post('/files/:fileId/restore/:version', async (req, res) => {
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const targetVersion = await CollabVersion.findOne({ file: file._id, version: Number(req.params.version) });
  if (!targetVersion) return res.status(404).json({ error: 'Target version not found.' });

  file.content = targetVersion.snapshot;
  file.latestVersion += 1;
  await file.save();

  const restoreVersion = await CollabVersion.create({
    file: file._id,
    group: file.group,
    version: file.latestVersion,
    branch: targetVersion.branch,
    parentVersion: file.latestVersion - 1,
    snapshot: targetVersion.snapshot,
    patchSummary: `Restored from version ${targetVersion.version}`,
    author: req.user.id,
    restoredFrom: targetVersion.version,
  });

  await ActivityLog.create({
    group: file.group,
    file: file._id,
    user: req.user.id,
    action: 'version_restored',
    metadata: { from: targetVersion.version, to: restoreVersion.version },
  });

  return res.json({ file, restoreVersion });
});


router.post('/code/run', async (req, res) => {
  const { groupId, code = '', language = 'javascript' } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  if (language !== 'javascript') {
    return res.status(400).json({ error: 'Only javascript is currently supported.' });
  }

  const image = process.env.CODE_RUNNER_IMAGE || 'node:20-alpine';
  const timeoutMs = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 6000);
  const memoryMb = Number(process.env.CODE_RUNNER_MEMORY_MB || 128);

  try {
    const { stdout, stderr } = await execFileAsync('docker', [
      'run', '--rm',
      '--network', 'none',
      '--cpus', '0.5',
      '--memory', `${memoryMb}m`,
      image,
      'node', '-e', String(code),
    ], { timeout: timeoutMs, maxBuffer: 1024 * 1024 });

    await ActivityLog.create({
      group: groupId,
      user: req.user.id,
      action: 'code_executed',
      metadata: { language, success: true },
    });

    return res.json({ stdout, stderr });
  } catch (error) {
    await ActivityLog.create({
      group: groupId,
      user: req.user.id,
      action: 'code_executed',
      metadata: { language, success: false, message: error.message },
    });

    const message = /ENOENT/.test(error.message)
      ? 'Docker is not available on this server. Configure container runtime first.'
      : `Code execution failed: ${error.message}`;

    return res.status(/ENOENT/.test(error.message) ? 503 : 500).json({ error: message, stderr: error.stderr || '' });
  }
});

router.get('/activity', async (req, res) => {
  const { groupId, userId, action } = req.query;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const filter = { group: groupId };
  if (userId) filter.user = userId;
  if (action) filter.action = action;

  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(250)
    .populate('user', 'name email')
    .populate('file', 'name type');

  return res.json(logs);
});

module.exports = router;
