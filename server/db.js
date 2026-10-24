import mysql from 'mysql2/promise';
import './env.js';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  // Cloud MySQL (e.g. Aiven) needs SSL: set DB_SSL=true there
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
