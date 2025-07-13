// app.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./third_party/supabaseClient');
const expressLayouts = require('express-ejs-layouts');

const app = express();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
// Optional: set default layout
app.set('layout', 'layout');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Middleware to check if logged in
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Routes

// Show login form
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Handle login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
        });
   console.log( data )
  if (error || !data) {
    return res.render('login', { error: 'Invalid credentials' });
  }

  req.session.user = data.user;
  res.redirect('/posts');
});

// Handle logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Posts list
app.get('/posts', requireAuth, async (req, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  res.render('posts/index', { posts });
});

// Show create post form
app.get('/posts/create', requireAuth, (req, res) => {
  res.render('posts/create');
});

// Create post handler
app.post('/posts/create', requireAuth, async (req, res) => {
  const { title, content, published } = req.body;
  await supabase.from('posts').insert([{ 
    title, 
    content, 
    published: published === 'on', 
    created_at: new Date() 
  }]);
  res.redirect('/posts');
});

// Show edit post form
app.get('/posts/:id/edit', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();

  res.render('posts/edit', { post });
});

// Update post handler
app.post('/posts/:id/edit', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { title, content, published } = req.body;
  await supabase.from('posts').update({ 
    title, 
    content, 
    published: published === 'on' 
  }).eq('id', id);

  res.redirect('/posts');
});

// Delete post handler
app.post('/posts/:id/delete', requireAuth, async (req, res) => {
  const id = req.params.id;
  await supabase.from('posts').delete().eq('id', id);
  res.redirect('/posts');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
