const router = require('express').Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv'];
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.macro.enabled',
];

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../workspace_files/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for allowed types only
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File extension ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
  
  // For CSV files, accept any mimetype (varies by system/browser)
  if (ext === '.csv') {
    return cb(null, true);
  }
  
  // For other files, check MIME type
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    console.warn(`Warning: MIME type ${file.mimetype} not in allowed list for ${file.originalname}`);
    // Don't reject - allow with warning as MIME types can vary
  }
  
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/upload - Health check
router.get('/', (req, res) => {
  res.json({ 
    message: 'Upload endpoint is active',
    allowedTypes: ALLOWED_EXTENSIONS.join(', '),
    maxSize: '10MB'
  });
});

// POST /api/upload - File upload (restricted to PDF & Spreadsheets only)
router.post('/', auth, (req, res) => {
  console.log('[UPLOAD] New upload request from user:', req.user?.id);
  
  // Use upload.single middleware with error handling
  upload.single('file')(req, res, (err) => {
    try {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        console.error('[UPLOAD] MulterError:', err.code, err.message);
        if (err.code === 'FILE_TOO_LARGE') {
          return res.status(413).json({ error: 'File size exceeds 10MB limit' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Only one file allowed' });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }

      // Handle custom errors from fileFilter
      if (err) {
        console.error('[UPLOAD] Custom error:', err.message);
        return res.status(400).json({ error: err.message || 'File upload error' });
      }

      // Check if file exists
      if (!req.file) {
        console.error('[UPLOAD] No file in request');
        return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
      }

      // Success response
      console.log('[UPLOAD] File uploaded successfully:', req.file.filename);
      const fileUrl = `/uploads/${req.file.filename}`;
      return res.status(200).json({ 
        success: true,
        url: fileUrl, 
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        message: 'File uploaded successfully'
      });
    } catch (error) {
      console.error('[UPLOAD] Endpoint error:', error);
      return res.status(500).json({ error: 'Server error uploading file' });
    }
  });
});

module.exports = router;
