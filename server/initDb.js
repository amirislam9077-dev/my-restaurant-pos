import fs from 'fs';
import mysql from 'mysql2/promise';
import './env.js';
import { hashPassword } from './auth.js';

const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  // Cloud MySQL (e.g. Aiven) needs SSL: set DB_SSL=true there
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
await conn.query(`SET time_zone = '${process.env.DB_TIMEZONE || '+05:00'}'`);
await conn.query(sql);

// Migrations for databases created by an older schema.sql
const hasColumn = async (table, column) => {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    ['hotel_db', table, column]
  );
  return rows.length > 0;
};
if (!(await hasColumn('menu_items', 'image'))) {
  await conn.query('ALTER TABLE hotel_db.menu_items ADD COLUMN image VARCHAR(255) NULL AFTER price');
}
if (!(await hasColumn('menu_items', 'description'))) {
  await conn.query(`ALTER TABLE hotel_db.menu_items
    ADD COLUMN description VARCHAR(255) NULL AFTER category,
    ADD COLUMN old_price DECIMAL(10,2) NULL AFTER price,
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER image`);
}
// Scale: items sold by weight (price is per kg) and a per-line label like "Chicken (1.250 kg)"
if (!(await hasColumn('menu_items', 'sold_by'))) {
  await conn.query("ALTER TABLE hotel_db.menu_items ADD COLUMN sold_by VARCHAR(10) NOT NULL DEFAULT 'piece' AFTER price");
}
if (!(await hasColumn('order_items', 'label'))) {
  await conn.query('ALTER TABLE hotel_db.order_items ADD COLUMN label VARCHAR(150) NULL AFTER price');
}
if (!(await hasColumn('orders', 'customer_email'))) {
  await conn.query('ALTER TABLE hotel_db.orders ADD COLUMN customer_email VARCHAR(120) NULL AFTER customer_phone');
}
if (!(await hasColumn('orders', 'paid_amount'))) {
  await conn.query('ALTER TABLE hotel_db.orders ADD COLUMN paid_amount DECIMAL(10,2) NULL AFTER total');
}
if (!(await hasColumn('orders', 'paid_at'))) {
  await conn.query('ALTER TABLE hotel_db.orders ADD COLUMN paid_at TIMESTAMP NULL AFTER paid_amount');
  // Older paid orders: best guess is the time they were created
  await conn.query(`UPDATE hotel_db.orders SET paid_at = created_at WHERE status = 'paid' AND paid_at IS NULL`);
}
if (!(await hasColumn('orders', 'order_no'))) {
  await conn.query('ALTER TABLE hotel_db.orders ADD COLUMN order_no INT NULL AFTER order_type');
}
// Admin can log in with an email as well as the username
if (!(await hasColumn('admins', 'email'))) {
  await conn.query('ALTER TABLE hotel_db.admins ADD COLUMN email VARCHAR(120) NULL UNIQUE AFTER username');
}
// Number any orders that don't have one yet: per type, per day, in id order
const [unnumbered] = await conn.query('SELECT id, order_type, DATE(created_at) AS day FROM hotel_db.orders WHERE order_no IS NULL ORDER BY id');
for (const o of unnumbered) {
  await conn.query(
    `UPDATE hotel_db.orders SET order_no = (
       SELECT n FROM (SELECT COALESCE(MAX(order_no), 0) + 1 AS n FROM hotel_db.orders WHERE order_type = ? AND DATE(created_at) = ?) AS x
     ) WHERE id = ?`,
    [o.order_type, o.day, o.id]
  );
}
if (!(await hasColumn('orders', 'waiter_id'))) {
  await conn.query(`ALTER TABLE hotel_db.orders ADD COLUMN waiter_id INT NULL AFTER table_id,
    ADD FOREIGN KEY (waiter_id) REFERENCES hotel_db.waiters(id)`);
}

// Sample photos for the seeded menu (only where no photo is set yet)
const seedImages = {
  'Chicken Biryani': 'seed-biryani.jpg',
  'Chicken Karahi': 'seed-karahi.jpg',
  'Daal Makhni': 'seed-daal.jpg',
  'Butter Naan': 'seed-naan.jpg',
  'Roti': 'seed-roti.jpg',
  'Zinger Burger': 'seed-burger.jpg',
  'Salad': 'seed-salad.jpg',
  'Mint Lemonade': 'seed-lemonade.jpg',
  'Kheer': 'seed-kheer.jpg',
  'Cold Drink': 'seed-colddrink.jpg',
  'Raita': 'seed-raita.jpg',
};
for (const [name, file] of Object.entries(seedImages)) {
  if (!fs.existsSync(new URL(`./uploads/${file}`, import.meta.url))) continue;
  await conn.query('UPDATE hotel_db.menu_items SET image = ? WHERE name = ? AND image IS NULL', [`/uploads/${file}`, name]);
}

// Default admin login: admin / admin123 (change after first login)
const [admins] = await conn.query('SELECT id FROM admins LIMIT 1');
if (!admins.length) {
  await conn.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hashPassword('admin123')]);
  console.log('Default admin created: admin / admin123');
}
await conn.end();
console.log('Database ready: hotel_db');
