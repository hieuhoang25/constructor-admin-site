const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// Multer setup: store file in memory
const upload = multer({ storage: multer.memoryStorage() });

// Cloudinary config
cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME',
  api_key: 'YOUR_API_KEY',
  api_secret: 'YOUR_API_SECRET',
});

// POST /upload-image
router.post('/upload-image', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'blog_images' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({ error: 'Upload failed' });
        }
        return res.json({ location: result.secure_url });
      }
    );

    // Stream file buffer to Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(stream);

  } catch (err) {
    console.error('Unexpected Error:', err);
    // Ensure only one response is sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

module.exports = router;
