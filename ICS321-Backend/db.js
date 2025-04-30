const mysql = require('mysql2');

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Root@ICS321$',   // your password
  database: 'mydb',           // your database
  port: 3306                  // default MySQL port
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to the MySQL database.');
});

module.exports = db;
