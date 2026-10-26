import express from 'express';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import './env.js';
import { pool } from './db.js';
import { requireAdmin, optionalAdmin, checkPassword, createToken, hashPassword } from './auth.js';
import { reportsRouter } from './reports.js';
import { notifyCustomer, isEmail } from './notify.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

const UPLOAD_DIR = new URL('./uploads/', import.meta.url);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(fileURLToPath(UPLOAD_DIR)));

const STATUSES = ['pending', 'accepted', 'served', 'paid', 'cancelled'];
const ORDER_TYPES = ['dine_in', 'takeaway', 'phone', 'online'];
const ACTIVE = "('pending','accepted','served')";

// ---------- Auth ----------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
  if (!rows.length || !checkPassword(password || '', rows[0].password_hash)) {
    return res.status(401).json({ error: 'Galat username ya password' });
  }
  res.json({ token: createToken(rows[0]), username: rows[0].username });
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
  if (!rows.length || !checkPassword(oldPassword || '', rows[0].password_hash)) {
    return res.status(400).json({ error: 'Purana password galat hai' });
  }
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Naya password kam se kam 6 characters' });
  await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.admin.id]);
  res.json({ ok: true });
});

// LAN addresses so table QR codes open on customers' phones
app.get('/api/server-info', (req, res) => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
  res.json({ ips });
});

// ---------- Tables ----------
app.get('/api/tables', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT t.*,
      SUM(o.status IN ${ACTIVE}) AS active_orders,
      SUM(o.status = 'pending') AS pending_orders,
      COALESCE(SUM(CASE WHEN o.status IN ${ACTIVE} THEN o.total END), 0) AS running_total
    FROM restaurant_tables t
    LEFT JOIN orders o ON o.table_id = t.id
    GROUP BY t.id ORDER BY t.id`);
  res.json(rows.map(r => ({
    ...r,
    active_orders: Number(r.active_orders || 0),
    pending_orders: Number(r.pending_orders || 0),
    running_total: Number(r.running_total),
  })));
});

app.get('/api/tables/:id/orders', async (req, res) => {
  res.json(await loadOrders(`WHERE table_id = ? AND status IN ${ACTIVE}`, [req.params.id]));
});

// Table bill paid: close all its accepted/served orders.
// Optional paid_amount = cash for the whole table; each order records its own total, the newest one carries the change.
app.post('/api/tables/:id/close', requireAdmin, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, total FROM orders WHERE table_id = ? AND status IN ('accepted','served') ORDER BY id`, [req.params.id]
  );
  if (!orders.length) return res.status(400).json({ error: 'Is table pe koi order band karne ko nahi' });
  const total = orders.reduce((s, o) => s + o.total, 0);
  const paid = req.body.paid_amount === undefined ? total : Number(req.body.paid_amount);
  if (!(paid >= total)) return res.status(400).json({ error: `Received amount total (Rs ${total}) se kam hai` });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [i, o] of orders.entries()) {
      const isLast = i === orders.length - 1;
      await conn.query(`UPDATE orders SET status = 'paid', paid_amount = ?, paid_at = NOW() WHERE id = ?`, [isLast ? o.total + (paid - total) : o.total, o.id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.json({ ok: true, ids: orders.map(o => o.id), total, paid_amount: paid });
});

// ---------- Menu ----------
// Items in heading order (menu_categories.sort_order), then their own order; each row carries its heading's tag
app.get('/api/menu', optionalAdmin, async (req, res) => {
  const conds = [req.query.scale ? "m.sold_by = 'kg'" : "m.sold_by = 'piece'"];
  if (!(req.admin && req.query.all)) conds.push('m.available = 1');
  const where = 'WHERE ' + conds.join(' AND ');
  const [rows] = await pool.query(
    `SELECT m.*, c.tag AS category_tag
     FROM menu_items m LEFT JOIN menu_categories c ON c.name = m.category
     ${where}
     ORDER BY COALESCE(c.sort_order, 999), m.category, m.sort_order, m.id`
  );
  res.json(rows);
});

function menuFields(body) {
  const { name, category, description, price, old_price, available, image } = body;
  if (!name?.trim() || !category?.trim() || !(Number(price) > 0)) {
    throw Object.assign(new Error('Name, category aur price zaroori hain'), { status: 400 });
  }
  const img = typeof image === 'string' && image.startsWith('/uploads/') ? image : null;
  const old = Number(old_price) > Number(price) ? Number(old_price) : null;
  const soldBy = body.sold_by === 'kg' ? 'kg' : 'piece';
  return [name.trim(), category.trim(), description?.trim() || null, Number(price), old, img, available === false ? 0 : 1, soldBy];
}

app.post('/api/menu', requireAdmin, async (req, res) => {
  const fields = menuFields(req.body);
  const [r] = await pool.query(
    'INSERT INTO menu_items (name, category, description, price, old_price, image, available, sold_by, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 9999)',
    fields
  );
  res.status(201).json({ id: r.insertId });
});

app.put('/api/menu/:id', requireAdmin, async (req, res) => {
  const fields = menuFields(req.body);
  await pool.query(
    'UPDATE menu_items SET name = ?, category = ?, description = ?, price = ?, old_price = ?, image = ?, available = ?, sold_by = ? WHERE id = ?',
    [...fields, req.params.id]
  );
  res.json({ ok: true });
});

// Menu photo upload: body { image: "data:image/jpeg;base64,..." }
app.post('/api/upload', requireAdmin, (req, res) => {
  const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(req.body.image || '');
  if (!match) return res.status(400).json({ error: 'Sirf JPG, PNG ya WEBP photo' });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const file = `menu-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(new URL(file, UPLOAD_DIR), Buffer.from(match[2], 'base64'));
  res.status(201).json({ url: `/uploads/${file}` });
});

app.delete('/api/menu/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    // Item already used in old orders: hide it instead of deleting
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
    await pool.query('UPDATE menu_items SET available = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, hidden: true });
  }
});

// ---------- Waiters ----------
app.get('/api/waiters', requireAdmin, async (req, res) => {
  const where = req.query.all ? '' : 'WHERE active = 1';
  const [rows] = await pool.query(`SELECT * FROM waiters ${where} ORDER BY name`);
  res.json(rows);
});

function waiterFields(body) {
  const { name, phone, active } = body;
  if (!name?.trim()) throw Object.assign(new Error('Waiter ka naam zaroori hai'), { status: 400 });
  return [name.trim(), phone?.trim() || null, active === false ? 0 : 1];
}

app.post('/api/waiters', requireAdmin, async (req, res) => {
  const [r] = await pool.query('INSERT INTO waiters (name, phone, active) VALUES (?, ?, ?)', waiterFields(req.body));
  res.status(201).json({ id: r.insertId });
});

app.put('/api/waiters/:id', requireAdmin, async (req, res) => {
  await pool.query('UPDATE waiters SET name = ?, phone = ?, active = ? WHERE id = ?', [...waiterFields(req.body), req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/waiters/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM waiters WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    // Waiter has old orders: deactivate instead of deleting
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
    await pool.query('UPDATE waiters SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, hidden: true });
  }
});

// ---------- Orders ----------
async function loadOrders(where, params, limit = '') {
  const [orders] = await pool.query(
    `SELECT o.*, (SELECT name FROM waiters w WHERE w.id = o.waiter_id) AS waiter_name
     FROM orders o ${where} ORDER BY created_at DESC, id DESC ${limit}`,
    params
  );
  if (!orders.length) return [];
  const [items] = await pool.query(
    `SELECT oi.order_id, oi.menu_item_id, oi.qty, oi.price, COALESCE(oi.label, m.name) AS name
     FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
     WHERE oi.order_id IN (?)`,
    [orders.map(o => o.id)]
  );
  return orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) }));
}

// Admin: active orders, or ?history=1 for closed ones
app.get('/api/orders', requireAdmin, async (req, res) => {
  const where = req.query.history
    ? "WHERE status IN ('paid','cancelled') AND DATE(created_at) = CURDATE()"
    : `WHERE status IN ${ACTIVE}`;
  res.json(await loadOrders(where, [], req.query.history ? 'LIMIT 200' : ''));
});

app.get('/api/orders/:id', requireAdmin, async (req, res) => {
  const [order] = await loadOrders('WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Public tracking for online customers (no personal data returned)
app.get('/api/track/:id', async (req, res) => {
  const [order] = await loadOrders('WHERE id = ? AND order_type = ?', [req.params.id, 'online']);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({
    id: order.id, order_type: order.order_type, order_no: order.order_no,
    status: order.status, total: order.total, items: order.items, created_at: order.created_at,
  });
});

// Place order. Customers: dine_in / online. Admin only: takeaway / phone.
// Orders from the CFC website (kfc-clone-demo.vercel.app) checkout. It sends item names, not our ids:
// match them to our menu by name, then continue as a normal online order (prices always from our menu).
app.post('/api/public/online-order', async (req, res, next) => {
  const b = req.body || {};
  const wanted = (Array.isArray(b.items) ? b.items : []).filter(i => i?.name && Number(i.qty) > 0);
  if (!wanted.length) return res.status(400).json({ error: 'No items' });
  const [menu] = await pool.query(
    'SELECT id, name FROM menu_items WHERE available = 1 AND LOWER(name) IN (?)',
    [wanted.map(i => String(i.name).trim().toLowerCase())]
  );
  const idOf = Object.fromEntries(menu.map(m => [m.name.toLowerCase(), m.id]));
  const missing = wanted.filter(i => !idOf[String(i.name).trim().toLowerCase()]).map(i => i.name);
  if (missing.length) return res.status(400).json({ error: 'Menu mein nahi mila: ' + missing.join(', ') });

  const takeaway = /takeaway/i.test(b.type || '');
  const note = [
    b.ref && `Website ${b.ref}`,
    takeaway ? 'Takeaway (customer khud lega)' : 'Home Delivery',
    b.payment,
    !takeaway && b.deliveryFee ? `Delivery fee Rs ${b.deliveryFee}` : null,
    b.landmark && `Landmark: ${b.landmark}`,
    b.notes,
  ].filter(Boolean).join(' · ').slice(0, 255);
  req.body = {
    order_type: 'online',
    customer_name: b.name, customer_phone: b.phone, customer_email: b.email,
    address: takeaway ? 'Takeaway - customer khud lega' : b.address,
    note,
    items: wanted.map(i => ({ menu_item_id: idOf[String(i.name).trim().toLowerCase()], qty: Math.floor(Number(i.qty)) })),
  };
  req.admin = null; // website customers are never staff
  next();
});

app.post(['/api/orders', '/api/public/online-order'], (req, res, next) => (req.path === '/api/orders' ? optionalAdmin(req, res, next) : next()), async (req, res) => {
  const { order_type = 'dine_in', table_id, items, note, customer_name, customer_phone, address } = req.body;
  const customer_email = req.body.customer_email?.trim() || null;
  if (customer_email && !isEmail(customer_email)) return res.status(400).json({ error: 'Email sahi nahi hai' });
  // Only staff can assign a waiter
  const waiter_id = req.admin && order_type === 'dine_in' && req.body.waiter_id ? Number(req.body.waiter_id) : null;
  if (!ORDER_TYPES.includes(order_type)) return res.status(400).json({ error: 'Invalid order type' });
  if (['takeaway', 'phone'].includes(order_type) && !req.admin) return res.status(401).json({ error: 'Login required' });
  if (order_type === 'dine_in' && !table_id) return res.status(400).json({ error: 'Table select karein' });
  if (order_type === 'online' && (!customer_name?.trim() || !customer_phone?.trim() || !address?.trim())) {
    return res.status(400).json({ error: 'Naam, phone aur address zaroori hain' });
  }
  if (order_type === 'phone' && (!customer_name?.trim() || !customer_phone?.trim())) {
    return res.status(400).json({ error: 'Customer naam aur phone zaroori hain' });
  }
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Koi item select nahi kiya' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [menu] = await conn.query('SELECT id, name, price, sold_by FROM menu_items WHERE id IN (?) AND available = 1', [items.map(i => i.menu_item_id)]);
    const menuById = Object.fromEntries(menu.map(m => [m.id, m]));
    const lines = [];
    for (const i of items) {
      const m = menuById[i.menu_item_id];
      if (!m) continue;
      if (m.sold_by === 'kg') {
        const kg = Number(i.weight_kg);
        if (!(kg > 0 && kg <= 1000)) continue;
        // Weighed items can only be sold from the admin Scale page
        if (!req.admin) continue;
        lines.push({ id: m.id, qty: 1, price: Math.round(m.price * kg), label: `${m.name} (${kg.toFixed(3)} kg)` });
      } else if (i.qty > 0) {
        lines.push({ id: m.id, qty: Math.floor(i.qty), price: m.price, label: null });
      }
    }
    if (!lines.length) throw new Error('No valid items');
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    // Orders taken by admin directly are already accepted (dine-in only when sent from the admin panel)
    const byAdmin = req.admin && (order_type === 'takeaway' || order_type === 'phone' || (order_type === 'dine_in' && req.body.from_admin));
    // Counter takeaway is paid on the spot: saved straight as 'paid' so nothing stays pending
    const payNow = req.admin && order_type === 'takeaway' && req.body.pay_now;
    let paid_amount = null;
    if (payNow) {
      paid_amount = req.body.paid_amount === undefined || req.body.paid_amount === '' ? total : Number(req.body.paid_amount);
      if (!(paid_amount >= total)) throw new Error(`Received amount total (Rs ${total}) se kam hai`);
    }
    const status = payNow ? 'paid' : byAdmin ? 'accepted' : 'pending';

    if (waiter_id) {
      const [w] = await conn.query('SELECT id FROM waiters WHERE id = ? AND active = 1', [waiter_id]);
      if (!w.length) throw new Error('Waiter nahi mila');
    }

    // Next daily number for this order type (locks today's rows of this type until commit)
    const [[{ next }]] = await conn.query(
      'SELECT COALESCE(MAX(order_no), 0) + 1 AS next FROM orders WHERE order_type = ? AND DATE(created_at) = CURDATE() FOR UPDATE',
      [order_type]
    );

    const [result] = await conn.query(
      `INSERT INTO orders (order_type, order_no, table_id, waiter_id, customer_name, customer_phone, customer_email, address, status, note, total, paid_amount, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'paid', NOW(), NULL))`,
      [order_type, next, order_type === 'dine_in' ? table_id : null, waiter_id, customer_name || null, customer_phone || null,
        customer_email, address || null, status, note || null, total, paid_amount, status]
    );
    await conn.query(
      'INSERT INTO order_items (order_id, menu_item_id, qty, price, label) VALUES ?',
      [lines.map(l => [result.insertId, l.id, l.qty, l.price, l.label])]
    );
    await conn.commit();
    // Order confirmation by email / WhatsApp (only when the customer gave them)
    let notify = null;
    if (customer_phone || customer_email) {
      const nameOf = Object.fromEntries(menu.map(m => [m.id, m.name]));
      notify = notifyCustomer(
        { order_type, order_no: next, table_id: order_type === 'dine_in' ? table_id : null, customer_name, customer_phone, customer_email, status, total },
        lines.map(l => ({ name: l.label || nameOf[l.id], qty: l.qty, price: l.price }))
      );
    }
    res.status(201).json({ id: result.insertId, order_type, order_no: next, status, total, paid_amount, notify });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  // Paying: optionally record the cash handed over (change = paid_amount - total)
  if (status === 'paid' && req.body.paid_amount !== undefined) {
    const [[order]] = await pool.query('SELECT total FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const paid = Number(req.body.paid_amount);
    if (!(paid >= order.total)) return res.status(400).json({ error: `Received amount total (Rs ${order.total}) se kam hai` });
    await pool.query('UPDATE orders SET status = ?, paid_amount = ?, paid_at = NOW() WHERE id = ?', [status, paid, req.params.id]);
    return res.json({ ok: true, total: order.total, paid_amount: paid });
  }
  // paid_at = when the money came in (used by the sales reports)
  await pool.query(
    `UPDATE orders SET status = ?, paid_at = IF(? = 'paid', COALESCE(paid_at, NOW()), paid_at) WHERE id = ?`,
    [status, status, req.params.id]
  );
  res.json({ ok: true });
});

app.use('/api', reportsRouter);

// Production (Render): the same server also serves the built React app from client/dist
const CLIENT_DIST = fileURLToPath(new URL('../client/dist/', import.meta.url));
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // Any other page (/, /takeaway, /reports/...) is a React route -> index.html
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(CLIENT_DIST + 'index.html'));
}

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
