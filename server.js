// server.js
require('dotenv').config(); // Load environment variables (if using .env)
const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Make sure db.js uses process.env
const verifyToken = require('./auth');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Real-time Socket.IO
io.on('connection', (socket) => {
  console.log('✅ Socket connected');
  socket.on('newData', () => {
    socket.broadcast.emit('newData');
  });
});

// Register
app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, role]
    );
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Register error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: rows[0].id, role: rows[0].role },
      process.env.JWT_SECRET || 'secret123', // Use env secret or fallback
      { expiresIn: '1h' }
    );

    res.json({ token, role: rows[0].role });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get student notifications and assignments
app.get('/student-data', verifyToken, async (req, res) => {
  try {
    const [notifications] = await db.execute("SELECT * FROM notifications ORDER BY created_at DESC");
    const [assignments] = await db.execute("SELECT * FROM assignments ORDER BY created_at DESC");
    res.json({ notifications, assignments });
  } catch (error) {
    console.error('❌ Fetch student data error:', error.message);
    res.sendStatus(500);
  }
});

// Post notification
app.post('/post-notification', verifyToken, async (req, res) => {
  if (req.user.role !== 'lecturer') return res.sendStatus(403);
  const { content } = req.body;

  try {
    await db.execute("INSERT INTO notifications (content) VALUES (?)", [content]);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Post notification error:', error.message);
    res.sendStatus(500);
  }
});

// Post assignment
app.post('/post-assignment', verifyToken, async (req, res) => {
  if (req.user.role !== 'lecturer') return res.sendStatus(403);
  const { content } = req.body;

  try {
    await db.execute("INSERT INTO assignments (content) VALUES (?)", [content]);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Post assignment error:', error.message);
    res.sendStatus(500);
  }
});

// Delete notification
app.delete('/delete-notification/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'lecturer') return res.sendStatus(403);

  try {
    await db.execute("DELETE FROM notifications WHERE id = ?", [req.params.id]);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Delete notification error:', error.message);
    res.sendStatus(500);
  }
});

// Delete assignment
app.delete('/delete-assignment/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'lecturer') return res.sendStatus(403);

  try {
    await db.execute("DELETE FROM assignments WHERE id = ?", [req.params.id]);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Delete assignment error:', error.message);
    res.sendStatus(500);
  }
});

// Fallback for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
