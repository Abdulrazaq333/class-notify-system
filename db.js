// db.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // replace with your password
  database: 'class_system' // your DB name
});

// Test connection on startup
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ MySQL pool connected successfully!');
    connection.release(); // release connection back to the pool
  } catch (error) {
    console.error('❌ Failed to connect to MySQL:', error.message);
  }
})();

module.exports = db;
