const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Membership = require('../models/Membership');
const CollabFile = require('../models/CollabFile');
const CollabVersion = require('../models/CollabVersion');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { syncToDisk, BASE_DIR } = require('../utils/fileSync');
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

function normalizeFileName(fileName) {
  const normalized = String(fileName || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  if (!normalized) return '';

  const safeName = path.posix.normalize(normalized);
  if (!safeName || safeName === '.' || safeName.startsWith('../') || safeName.includes('/../')) {
    return '';
  }

  return safeName;
}

function resolveFileType(fileName, preferredType = 'document') {
  const normalizedPreferredType = ['code', 'document', 'spreadsheet'].includes(preferredType)
    ? preferredType
    : 'document';
  const ext = path.extname(fileName).toLowerCase();

  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (normalizedPreferredType === 'code') return 'code';
  return 'document';
}

function createInitialContent(fileType) {
  if (fileType === 'spreadsheet') {
    return { cells: {} };
  }

  return { text: '' };
}

function readFileContentFromDisk(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const looksBinary = BINARY_DOCUMENT_EXTENSIONS.has(ext) || ext === '.xls' || ext === '.xlsx' || buffer.includes(0);

  if (looksBinary) {
    return { binary: true };
  }

  return { text: buffer.toString('utf8') };
}

async function removeEmptyParentDirs(filePath, rootDir) {
  const stopDir = path.resolve(rootDir);
  let currentDir = path.dirname(path.resolve(filePath));

  while (currentDir.startsWith(stopDir) && currentDir !== stopDir) {
    const entries = await fs.promises.readdir(currentDir);
    if (entries.length > 0) {
      break;
    }

    await fs.promises.rmdir(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

async function syncFilesystemToDB(groupId, rootDir, userId) {
  if (!fs.existsSync(rootDir)) {
    return { syncedFiles: 0, removedFiles: 0 };
  }

  const seenNames = new Set();

  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativeName = normalizeFileName(path.relative(rootDir, absolutePath));
      if (!relativeName) {
        continue;
      }

      seenNames.add(relativeName);

      await CollabFile.findOneAndUpdate(
        { group: groupId, name: relativeName },
        {
          $set: {
            type: resolveFileType(relativeName),
            content: readFileContentFromDisk(absolutePath),
          },
          $setOnInsert: {
            group: groupId,
            createdBy: userId,
            latestVersion: 1,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

  await walk(rootDir);

  const existingFiles = await CollabFile.find({ group: groupId }).select('_id name');
  const removedFiles = existingFiles.filter((file) => !seenNames.has(normalizeFileName(file.name)));

  if (removedFiles.length > 0) {
    const removedIds = removedFiles.map((file) => file._id);
    await CollabVersion.deleteMany({ file: { $in: removedIds } });
    await CollabFile.deleteMany({ _id: { $in: removedIds } });
  }

  return { syncedFiles: seenNames.size, removedFiles: removedFiles.length };
}

router.use(auth, rateLimit({ windowMs: 60000, max: 240 }));

router.get('/groups/:groupId/files', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const groupDir = path.join(BASE_DIR, String(groupId));
  let files = await CollabFile.find({ group: groupId })
    .select('name type latestVersion createdAt updatedAt')
    .sort({ name: 1 });

  if (files.length === 0 && fs.existsSync(groupDir)) {
    await syncFilesystemToDB(groupId, groupDir, req.user.id);
    files = await CollabFile.find({ group: groupId })
      .select('name type latestVersion createdAt updatedAt')
      .sort({ name: 1 });
  }

  return res.json(files);
}));

router.post('/groups/:groupId/files', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { name, type = 'document' } = req.body || {};
  const normalizedName = normalizeFileName(name);

  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });
  if (!normalizedName) return res.status(400).json({ error: 'A valid file name is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const fileType = resolveFileType(normalizedName, type);

  try {
    const file = await CollabFile.create({
      group: groupId,
      name: normalizedName,
      type: fileType,
      content: createInitialContent(fileType),
      createdBy: req.user.id,
    });

    await CollabVersion.create({
      file: file._id,
      group: file.group,
      version: file.latestVersion,
      parentVersion: null,
      snapshot: file.content,
      patchSummary: 'Initial version',
      author: req.user.id,
      branch: 'main',
    });

    await syncToDisk(file.group, file.name, file.content);
    await ActivityLog.create({
      group: groupId,
      file: file._id,
      user: req.user.id,
      action: 'file_created',
      metadata: { fileName: normalizedName, type: fileType },
    });

    return res.status(201).json(file);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A file with that name already exists.' });
    }

    throw error;
  }
}));

router.get('/files/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  if (!isValidId(fileId)) return res.status(400).json({ error: 'Invalid fileId.' });

  const file = await CollabFile.findById(fileId).populate('comments.author', 'name email');
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  return res.json({
    ...file.toObject(),
    version: file.latestVersion,
  });
}));

router.delete('/files/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  if (!isValidId(fileId)) return res.status(400).json({ error: 'Invalid fileId.' });

  const file = await CollabFile.findById(fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const diskPath = path.join(BASE_DIR, String(file.group), file.name);

  await CollabVersion.deleteMany({ file: file._id });
  await CollabFile.deleteOne({ _id: file._id });

  if (fs.existsSync(diskPath)) {
    await fs.promises.unlink(diskPath);
    await removeEmptyParentDirs(diskPath, path.join(BASE_DIR, String(file.group)));
  }

  await ActivityLog.create({
    group: file.group,
    file: file._id,
    user: req.user.id,
    action: 'file_deleted',
    metadata: { fileName: file.name },
  });

  return res.json({ success: true });
}));

router.post('/files/:fileId/versions', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const { patchSummary = 'Manual save' } = req.body || {};
  if (!isValidId(fileId)) return res.status(400).json({ error: 'Invalid fileId.' });

  const file = await CollabFile.findById(fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const membership = await ensureMembership(file.group, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  file.latestVersion += 1;
  await file.save();

  const version = await CollabVersion.create({
    file: file._id,
    group: file.group,
    version: file.latestVersion,
    parentVersion: file.latestVersion - 1,
    snapshot: file.content,
    patchSummary,
    author: req.user.id,
    branch: 'main',
  });

  await ActivityLog.create({
    group: file.group,
    file: file._id,
    user: req.user.id,
    action: 'file_version_saved',
    metadata: { version: file.latestVersion, patchSummary },
  });

  return res.status(201).json(version);
}));

router.post('/groups/:groupId/sync', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const groupDir = path.join(BASE_DIR, String(groupId));
  const result = await syncFilesystemToDB(groupId, groupDir, req.user.id);

  await ActivityLog.create({
    group: groupId,
    user: req.user.id,
    action: 'filesystem_synced',
    metadata: result,
  });

  return res.json(result);
}));

router.post('/groups/:groupId/github/import', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { repoUrl, branch = 'main', repoFullname } = req.body;
  if (!repoUrl && !repoFullname) return res.status(400).json({ error: 'repoUrl or repoFullname is required.' });
  if (!isValidId(groupId)) return res.status(400).json({ error: 'Invalid groupId.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const groupDir = path.join(BASE_DIR, String(groupId));

  const user = await User.findById(req.user.id);
  let finalRepoUrl = repoUrl;
  
  if (repoFullname && user?.githubAccessToken) {
    finalRepoUrl = `https://${user.githubAccessToken}@github.com/${repoFullname}.git`;
  } else if (repoUrl && user?.githubAccessToken && repoUrl.includes('github.com')) {
    finalRepoUrl = repoUrl.replace('https://', `https://${user.githubAccessToken}@`);
  }

  try {
    if (!fs.existsSync(groupDir)) {
      await fs.promises.mkdir(groupDir, { recursive: true });
    }

    const nameForDir = repoFullname ? repoFullname.split('/').pop() : repoUrl.split('/').pop().replace('.git', '');
    const targetDir = path.join(groupDir, nameForDir || 'repo');

    // If targetDir exists, we might want to pull instead of clone or just error.
    // For now, let's just clone if not exists.
    if (!fs.existsSync(targetDir)) {
      await execFileAsync('git', ['clone', '--depth', '1', '-b', branch, finalRepoUrl, targetDir]);
    }

    await syncFilesystemToDB(groupId, groupDir, req.user.id);

    return res.json({ message: `Successfully imported ${nameForDir} from GitHub.` });
  } catch (error) {
    console.error('GitHub Import Error:', error);
    return res.status(500).json({ error: `Import failed: ${error.message}` });
  }
}));

// NEW: Git Status
router.get('/groups/:groupId/git/status', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const groupDir = path.join(BASE_DIR, String(groupId));

  if (!fs.existsSync(groupDir)) return res.json([]);

  try {
    // We need to find the git root. For now assume it's one level down if we imported a repo.
    const subdirs = fs.readdirSync(groupDir).filter(f => fs.statSync(path.join(groupDir, f)).isDirectory());
    let repoDir = groupDir;
    
    // Simple heuristic: if there's only one subdir and it has .git, use it.
    for(const sub of subdirs) {
        if(fs.existsSync(path.join(groupDir, sub, '.git'))) {
            repoDir = path.join(groupDir, sub);
            break;
        }
    }

    const { stdout } = await execFileAsync('git', ['-C', repoDir, 'status', '--porcelain']);
    const lines = stdout.split('\n').filter(Boolean);
    const status = lines.map(line => {
        const code = line.substring(0, 2);
        const name = line.substring(3);
        return { name, status: code.trim(), path: path.join(path.basename(repoDir), name) };
    });

    return res.json(status);
  } catch (error) {
    return res.status(500).json({ error: `Git status failed: ${error.message}` });
  }
}));

// NEW: Git Diff
router.get('/groups/:groupId/git/diff', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { file } = req.query;
  if(!file) return res.status(400).json({ error: 'file query param is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const groupDir = path.join(BASE_DIR, String(groupId));

  try {
    // Find repo dir (same logic as status)
    const subdirs = fs.readdirSync(groupDir).filter(f => fs.statSync(path.join(groupDir, f)).isDirectory());
    let repoDir = groupDir;
    for(const sub of subdirs) {
        if(fs.existsSync(path.join(groupDir, sub, '.git'))) {
            repoDir = path.join(groupDir, sub);
            break;
        }
    }

    // Get original content (HEAD)
    const { stdout: original } = await execFileAsync('git', ['-C', repoDir, 'show', `HEAD:${file}`]).catch(() => ({ stdout: '' }));
    
    // Get current content from disk
    const currentPath = path.join(repoDir, file);
    const current = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, 'utf8') : '';

    return res.json({ original, current });
  } catch (error) {
    return res.status(500).json({ error: `Git diff failed: ${error.message}` });
  }
}));

// NEW: Git Commit
router.post('/groups/:groupId/git/commit', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { commitMessage } = req.body;
  if (!commitMessage) return res.status(400).json({ error: 'commitMessage is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const user = await User.findById(req.user.id);
  const { BASE_DIR } = require('../utils/fileSync');
  const groupDir = path.join(BASE_DIR, String(groupId));

  try {
    const subdirs = fs.readdirSync(groupDir).filter(f => fs.statSync(path.join(groupDir, f)).isDirectory());
    let repoDir = groupDir;
    for(const sub of subdirs) {
        if(fs.existsSync(path.join(groupDir, sub, '.git'))) {
            repoDir = path.join(groupDir, sub);
            break;
        }
    }

    if (user.name) await execFileAsync('git', ['-C', repoDir, 'config', 'user.name', user.name]);
    if (user.email) await execFileAsync('git', ['-C', repoDir, 'config', 'user.email', user.email]);

    await execFileAsync('git', ['-C', repoDir, 'add', '.']);
    await execFileAsync('git', ['-C', repoDir, 'commit', '-m', String(commitMessage)]);

    return res.json({ message: 'Changes committed locally.' });
  } catch (error) {
    return res.status(500).json({ error: `Git commit failed: ${error.message}` });
  }
}));

// NEW: Git Pull
router.post('/groups/:groupId/git/pull', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { branch = 'main' } = req.body;

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const user = await User.findById(req.user.id);
  const { BASE_DIR } = require('../utils/fileSync');
  const groupDir = path.join(BASE_DIR, String(groupId));

  try {
    const subdirs = fs.readdirSync(groupDir).filter(f => fs.statSync(path.join(groupDir, f)).isDirectory());
    let repoDir = groupDir;
    for(const sub of subdirs) {
        if(fs.existsSync(path.join(groupDir, sub, '.git'))) {
            repoDir = path.join(groupDir, sub);
            break;
        }
    }

    if (user.githubAccessToken) {
        const remoteUrl = (await execFileAsync('git', ['-C', repoDir, 'remote', 'get-url', 'origin'])).stdout.trim();
        if (remoteUrl.includes('github.com')) {
            const authenticatedUrl = remoteUrl.replace(/https:\/\/(.*@)?github.com/, `https://${user.githubAccessToken}@github.com`);
            await execFileAsync('git', ['-C', repoDir, 'remote', 'set-url', 'origin', authenticatedUrl]);
        }
    }

    await execFileAsync('git', ['-C', repoDir, 'pull', 'origin', String(branch)]);
    await syncFilesystemToDB(groupId, groupDir, req.user.id);

    return res.json({ message: 'Changes pulled from GitHub.' });
  } catch (error) {
    return res.status(500).json({ error: `Git pull failed: ${error.message}` });
  }
}));

router.post('/git/push', asyncHandler(async (req, res) => {
  const { groupId, branch = 'main' } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required.' });

  const membership = await ensureMembership(groupId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a group member.' });

  const user = await User.findById(req.user.id);

  try {
    const groupDir = path.join(BASE_DIR, String(groupId));
    
    const subdirs = fs.readdirSync(groupDir).filter(f => fs.statSync(path.join(groupDir, f)).isDirectory());
    let repoDir = groupDir;
    for(const sub of subdirs) {
        if(fs.existsSync(path.join(groupDir, sub, '.git'))) {
            repoDir = path.join(groupDir, sub);
            break;
        }
    }
    
    // Ensure we use the token for push
    if (user.githubAccessToken) {
        const remoteUrl = (await execFileAsync('git', ['-C', repoDir, 'remote', 'get-url', 'origin'])).stdout.trim();
        if (remoteUrl.includes('github.com')) {
            const authenticatedUrl = remoteUrl.replace(/https:\/\/(.*@)?github.com/, `https://${user.githubAccessToken}@github.com`);
            await execFileAsync('git', ['-C', repoDir, 'remote', 'set-url', 'origin', authenticatedUrl]);
        }
    }

    const pushRes = await execFileAsync('git', ['-C', repoDir, 'push', 'origin', String(branch)]);

    await ActivityLog.create({
      group: groupId,
      user: req.user.id,
      action: 'git_push',
      metadata: { branch },
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
