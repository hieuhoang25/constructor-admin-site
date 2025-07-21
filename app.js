// app.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./third_party/supabaseClient');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // ADD THIS at the top

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true , limit: '10mb'}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
}));
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

/////////////////////////////////////////////////
// ✅ Routes
/////////////////////////////////////////////////

// 🔐 Login Page
app.get('/login', (req, res) => {
  res.render('login', {    
    title: 'Login Page',
    heading: 'Login to Admin Panel',
    result: null,
    error: null, });
});

// 🔐 Handle Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return res.render('login', { error: 'Invalid credentials',    title: 'Login Page',
    heading: 'Login to Admin Panel',
    result: null });
  }

  req.session.user = data.user;
  res.redirect('/posts');
});

// 🔓 Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// 📝 Posts Dashboard
app.get('/posts', requireAuth, async (req, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  res.render('posts/index', { posts });
});

// ➕ New Post Form
app.get('/posts/create', requireAuth, (req, res) => {
  res.render('posts/create');
});

// ✅ Create Post
app.post('/posts/create', requireAuth, async (req, res) => {
  const { title, content, published } = req.body;

  await supabase.from('posts').insert([{
    title,
    content,
    published: published === 'on',
    created_at: new Date(),
  }]);

  res.redirect('/posts');
});

// ✏️ Edit Post Form
app.get('/posts/:id/edit', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  res.render('posts/edit', { post });
});

// 🔄 Update Post
app.post('/posts/:id/edit', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, content, published } = req.body;

  await supabase.from('posts').update({
    title,
    content,
    published: published === 'on',
  }).eq('id', id);

  res.redirect('/posts');
});

// ❌ Delete Post
app.post('/posts/:id/delete', requireAuth, async (req, res) => {
  const { id } = req.params;

  await supabase.from('posts').delete().eq('id', id);
  res.redirect('/posts');
});


app.post('/upload-image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const streamUpload = (reqFileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(reqFileBuffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);

    // ✅ Return final Cloudinary URL
    res.json({ location: result.secure_url });

   console.info('Upload result from server:', result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/////////////////////////////////////////////////
// 🚀 Start Server
/////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
