const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Membership = require('../models/Membership');
const CollabFile = require('../models/CollabFile');
const CollabVersion = require('../models/CollabVersion');
const ActivityLog = require('../models/ActivityLog');
const { execFile } = require('child_process');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.kts',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.sql', '.sh', '.ps1',
]);

const TEXT_DOCUMENT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.env', '.log',
]);

const SPREADSHEET_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);
const BINARY_DOCUMENT_EXTENSIONS = new Set(['.doc', '.docx', '.pdf', '.zip']);

const ALLOWED_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS,
  ...TEXT_DOCUMENT_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
  ...BINARY_DOCUMENT_EXTENSIONS,
]);

async function ensureMembership(groupId, userId) {
  return Membership.findOne({ group: groupId, user: userId });
}


function isValidId(value) {
  return Boolean(value) && mongoose.isValidObjectId(value);
}

function isTextMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('text/')) return true;
  return new Set([
    'application/json',
    'application/javascript',
    'application/x-javascript',
    'application/xml',
    'application/x-sh',
    'application/x-python-code',
  ]).has(normalized);
}

function resolveUploadedType(ext) {
  if (SPREADSHEET_EXTENSIONS.has(ext)) return 'spreadsheet';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'document';
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.use(auth, rateLimit({ windowMs: 60000, max: 240 }));

router.get('/groups/:groupId/files', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });
  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const files = await CollabFile.find({ group: groupId }).sort({ updatedAt: -1 });
  return res.json(files);
}));

router.post('/groups/:groupId/files', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { name, type } = req.body;

  if (!name || !type) return res.status(400).json({ error: 'name and type are required.' });
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

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
}));

router.get('/files/:fileId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.fileId)) return res.status(400).json({ error: 'Invalid fileId.' });
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  return res.json(file);
}));

router.get('/files/:fileId/history', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.fileId)) return res.status(400).json({ error: 'Invalid fileId.' });
  const file = await CollabFile.findById(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const versions = await CollabVersion.find({ file: file._id })
    .sort({ version: -1 })
    .limit(100)
    .populate('author', 'name email');
  return res.json(versions);
}));

router.post('/files/:fileId/versions', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.fileId)) return res.status(400).json({ error: 'Invalid fileId.' });
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
}));

router.post('/files/:fileId/restore/:version', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.fileId)) return res.status(400).json({ error: 'Invalid fileId.' });
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
}));


router.post('/code/run', asyncHandler(async (req, res) => {
  const { groupId, code = '', language = 'javascript' } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

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
}));


router.post('/groups/:groupId/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  if (!req.file) return res.status(400).json({ error: 'file is required.' });

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: `Unsupported file extension: ${ext || 'unknown'}` });
  }

  const type = resolveUploadedType(ext);
  const shouldStoreAsText =
    type === 'code' ||
    TEXT_DOCUMENT_EXTENSIONS.has(ext) ||
    (type === 'document' && isTextMimeType(req.file.mimetype)) ||
    ext === '.csv';

  const content = shouldStoreAsText
    ? { text: req.file.buffer.toString('utf8') }
    : { binary: true, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size };

  const file = await CollabFile.create({
    group: groupId,
    name: req.file.originalname,
    type,
    content,
    createdBy: req.user.id,
    permissions: { approvalRequired: false },
  });

  await CollabVersion.create({
    file: file._id,
    group: groupId,
    version: 1,
    branch: 'main',
    snapshot: content,
    patchSummary: 'Uploaded file',
    author: req.user.id,
  });

  await ActivityLog.create({
    group: groupId,
    file: file._id,
    user: req.user.id,
    action: 'file_uploaded',
    metadata: { name: req.file.originalname, ext },
  });

  return res.status(201).json(file);
}));

router.post('/git/push', asyncHandler(async (req, res) => {
  const { groupId, commitMessage = 'collab update', branch = 'main' } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  if (!['owner', 'moderator'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only owner/moderator can push to git.' });
  }

  try {
    const repoDir = process.env.GIT_REPO_PATH || process.cwd();
    const { stdout: status } = await execFileAsync('git', ['-C', repoDir, 'status', '--porcelain']);

    if (!status.trim()) {
      return res.json({ success: true, message: 'No changes to push.' });
    }

    await execFileAsync('git', ['-C', repoDir, 'add', '.']);
    await execFileAsync('git', ['-C', repoDir, 'commit', '-m', String(commitMessage)]);
    const pushRes = await execFileAsync('git', ['-C', repoDir, 'push', 'origin', String(branch)]);

    await ActivityLog.create({
      group: groupId,
      user: req.user.id,
      action: 'git_push',
      metadata: { branch, commitMessage },
    });

    return res.json({ success: true, message: 'Pushed to git successfully.', output: (pushRes.stdout || '') + (pushRes.stderr || '') });
  } catch (error) {
    return res.status(500).json({ error: `Git push failed: ${error.message}` });
  }
}));

router.get('/activity', asyncHandler(async (req, res) => {
  const { groupId, userId, action } = req.query;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

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
}));

module.exports = router;
