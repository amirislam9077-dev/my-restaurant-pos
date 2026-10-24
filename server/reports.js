// Owner reports: sales, waiters, expenses, profit & loss. All admin-only.
import express from 'express';
import { pool } from './db.js';
import { requireAdmin } from './auth.js';

export const reportsRouter = express.Router();
reportsRouter.use(['/reports', '/expenses'], requireAdmin);

// A sale counts on the day the money came in
const SALE_DAY = 'DATE(COALESCE(o.paid_at, o.created_at))';
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function getRange(query) {
  const from = isDate(query.from) ? query.from : today();
  const to = isDate(query.to) ? query.to : from;
  return from <= to ? [from, to] : [to, from];
}

function daysBetween(from, to) {
  const days = [];
  for (let d = new Date(from + 'T00:00:00'); d <= new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    days.push(d.toLocaleDateString('en-CA'));
  }
  return days;
}

const num = (v) => Number(v || 0);
const ymd = (d) => (d instanceof Date ? d.toLocaleDateString('en-CA') : String(d).slice(0, 10));

// Everything the report pages need for one date range, in one call
reportsRouter.get('/reports', async (req, res) => {
  const [from, to] = getRange(req.query);
  const paidInRange = `o.status = 'paid' AND ${SALE_DAY} BETWEEN ? AND ?`;

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o WHERE ${paidInRange}`, [from, to]
  );
  const [byType] = await pool.query(
    `SELECT o.order_type, COUNT(*) AS orders, SUM(o.total) AS sales
     FROM orders o WHERE ${paidInRange} GROUP BY o.order_type`, [from, to]
  );
  const [[cancelled]] = await pool.query(
    `SELECT COUNT(*) AS orders, SUM(o.total) AS amount FROM orders o
     WHERE o.status = 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ?`, [from, to]
  );
  const [[open]] = await pool.query(
    `SELECT COUNT(*) AS orders, SUM(o.total) AS amount FROM orders o WHERE o.status IN ('pending','accepted','served')`
  );
  const [salesDaily] = await pool.query(
    `SELECT ${SALE_DAY} AS day, COUNT(*) AS orders, SUM(o.total) AS sales
     FROM orders o WHERE ${paidInRange} GROUP BY day`, [from, to]
  );
  const [expenseDaily] = await pool.query(
    `SELECT expense_date AS day, SUM(amount) AS amount FROM expenses
     WHERE expense_date BETWEEN ? AND ? GROUP BY expense_date`, [from, to]
  );
  const [expenseByCategory] = await pool.query(
    `SELECT category, COUNT(*) AS entries, SUM(amount) AS amount FROM expenses
     WHERE expense_date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC`, [from, to]
  );
  const [items] = await pool.query(
    `SELECT m.name, m.category, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items m ON m.id = oi.menu_item_id
     WHERE ${paidInRange} GROUP BY oi.menu_item_id ORDER BY revenue DESC`, [from, to]
  );
  const [byHour] = await pool.query(
    `SELECT HOUR(COALESCE(o.paid_at, o.created_at)) AS hour, COUNT(*) AS orders, SUM(o.total) AS sales
     FROM orders o WHERE ${paidInRange} GROUP BY hour ORDER BY hour`, [from, to]
  );
  // Waiters: every waiter appears, even with no orders in the range
  const [waiters] = await pool.query(
    `SELECT w.id, w.name, w.active,
       COUNT(o.id) AS orders,
       COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN CONCAT(o.table_id, '@', ${SALE_DAY}) END) AS tables_served,
       COALESCE(SUM(o.total), 0) AS sales,
       COALESCE(SUM((SELECT SUM(qty) FROM order_items WHERE order_id = o.id)), 0) AS items
     FROM waiters w
     LEFT JOIN orders o ON o.waiter_id = w.id AND ${paidInRange}
     GROUP BY w.id ORDER BY sales DESC, w.name`, [from, to]
  );
  const [waiterDaily] = await pool.query(
    `SELECT o.waiter_id, ${SALE_DAY} AS day, COUNT(*) AS orders, SUM(o.total) AS sales
     FROM orders o WHERE o.waiter_id IS NOT NULL AND ${paidInRange} GROUP BY o.waiter_id, day`, [from, to]
  );
  const [[waiterCancelled]] = await pool.query(
    `SELECT COUNT(*) AS n FROM orders o WHERE o.waiter_id IS NOT NULL AND o.status = 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ?`,
    [from, to]
  );

  // One row per calendar day so charts and tables have no gaps
  const salesBy = Object.fromEntries(salesDaily.map(r => [ymd(r.day), r]));
  const expBy = Object.fromEntries(expenseDaily.map(r => [ymd(r.day), num(r.amount)]));
  const daily = daysBetween(from, to).map(day => {
    const sales = num(salesBy[day]?.sales);
    const expenses = expBy[day] || 0;
    return { day, orders: num(salesBy[day]?.orders), sales, expenses, profit: sales - expenses };
  });

  const sales = num(totals.sales);
  const expenses = expenseDaily.reduce((s, r) => s + num(r.amount), 0);
  res.json({
    from, to,
    summary: {
      sales, orders: num(totals.orders), avgOrder: totals.orders ? sales / totals.orders : 0,
      expenses, profit: sales - expenses,
      cancelledOrders: num(cancelled.orders), cancelledAmount: num(cancelled.amount),
      openOrders: num(open.orders), openAmount: num(open.amount),
    },
    byType: byType.map(r => ({ type: r.order_type, orders: num(r.orders), sales: num(r.sales) })),
    daily,
    items: items.map(r => ({ name: r.name, category: r.category, qty: num(r.qty), revenue: num(r.revenue) })),
    byHour: byHour.map(r => ({ hour: r.hour, orders: num(r.orders), sales: num(r.sales) })),
    expenseByCategory: expenseByCategory.map(r => ({ category: r.category, entries: num(r.entries), amount: num(r.amount) })),
    waiters: waiters.map(w => ({
      id: w.id, name: w.name, active: !!w.active, orders: num(w.orders), tablesServed: num(w.tables_served),
      sales: num(w.sales), items: num(w.items), avgOrder: w.orders ? num(w.sales) / num(w.orders) : 0,
      daily: waiterDaily.filter(d => d.waiter_id === w.id).map(d => ({ day: ymd(d.day), orders: num(d.orders), sales: num(d.sales) })),
    })),
    waiterCancelledOrders: num(waiterCancelled.n),
  });
});

// Every paid order in the range (optionally one order type) with its items, for the order detail report
reportsRouter.get('/reports/orders', async (req, res) => {
  const [from, to] = getRange(req.query);
  const types = ['dine_in', 'takeaway', 'phone', 'online'];
  const type = types.includes(req.query.type) ? req.query.type : null;
  const [orders] = await pool.query(
    `SELECT o.id, o.order_type, o.order_no, o.table_id, o.customer_name, o.customer_phone, o.total, o.paid_amount,
       COALESCE(o.paid_at, o.created_at) AS paid_at, o.created_at,
       (SELECT name FROM waiters w WHERE w.id = o.waiter_id) AS waiter_name
     FROM orders o
     WHERE o.status = 'paid' AND ${SALE_DAY} BETWEEN ? AND ? ${type ? 'AND o.order_type = ?' : ''}
     ORDER BY paid_at DESC, o.id DESC`,
    type ? [from, to, type] : [from, to]
  );
  const ids = orders.map(o => o.id);
  const [items] = ids.length
    ? await pool.query(
      `SELECT oi.order_id, oi.qty, oi.price, COALESCE(oi.label, m.name) AS name, m.category
       FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id IN (?)`, [ids])
    : [[]];
  res.json({
    from, to, type,
    orders: orders.map(o => ({
      ...o, total: num(o.total), paid_amount: o.paid_amount == null ? null : num(o.paid_amount),
      day: ymd(o.paid_at),
      items: items.filter(i => i.order_id === o.id).map(i => ({ name: i.name, category: i.category, qty: i.qty, price: num(i.price) })),
    })),
  });
});

// Sales trends: daily, last 12 months, peak hours, best weekdays, per item.
// scope=scale -> only items sold by weight (Scale page); otherwise every paid sale.
reportsRouter.get('/reports/trends', async (req, res) => {
  const [from, to] = getRange(req.query);
  const scaleOnly = req.query.scope === 'scale';
  // Optional order type (dine_in, takeaway...) for the Orders report page; safe because it is whitelisted
  const type = ['dine_in', 'takeaway', 'phone', 'online'].includes(req.query.type) ? req.query.type : null;
  const PAID_AT = 'COALESCE(o.paid_at, o.created_at)';
  const base = `FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN menu_items m ON m.id = oi.menu_item_id
    WHERE o.status = 'paid' ${scaleOnly ? "AND m.sold_by = 'kg'" : ''} ${type ? `AND o.order_type = '${type}'` : ''}`;
  const inRange = `AND DATE(${PAID_AT}) BETWEEN ? AND ?`;
  const agg = 'SUM(oi.qty * oi.price) AS sales, COUNT(DISTINCT o.id) AS orders';

  const [daily] = await pool.query(`SELECT DATE(${PAID_AT}) AS day, ${agg} ${base} ${inRange} GROUP BY day`, [from, to]);
  const [byHour] = await pool.query(`SELECT HOUR(${PAID_AT}) AS hour, ${agg} ${base} ${inRange} GROUP BY hour`, [from, to]);
  const [byWeekday] = await pool.query(
    `SELECT DAYOFWEEK(${PAID_AT}) AS dow, ${agg}, COUNT(DISTINCT DATE(${PAID_AT})) AS days ${base} ${inRange} GROUP BY dow`, [from, to]
  );
  // 12 months ending with the month of "to"
  const end = new Date(to + 'T00:00:00');
  const startMonth = new Date(end.getFullYear(), end.getMonth() - 11, 1).toLocaleDateString('en-CA');
  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(${PAID_AT}, '%Y-%m') AS month, ${agg} ${base}
     AND DATE(${PAID_AT}) BETWEEN ? AND LAST_DAY(?) GROUP BY month`, [startMonth, to]
  );
  // Per item; for scale items the weight is read back from the line label "(1.250 kg)"
  const [items] = await pool.query(
    `SELECT m.id, m.name, m.sold_by, SUM(oi.qty * oi.price) AS sales, COUNT(*) AS line_count, SUM(oi.qty) AS qty,
       SUM(CAST(REGEXP_SUBSTR(oi.label, '[0-9]+\\\\.[0-9]+(?= kg\\\\))') AS DECIMAL(10,3))) AS kg
     ${base} ${inRange} GROUP BY m.id ORDER BY sales DESC`, [from, to]
  );

  const byDay = Object.fromEntries(daily.map(r => [ymd(r.day), r]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(end.getFullYear(), end.getMonth() - 11 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const byMonth = Object.fromEntries(monthly.map(r => [r.month, r]));
  res.json({
    from, to, scope: scaleOnly ? 'scale' : 'all',
    daily: daysBetween(from, to).map(day => ({ day, sales: num(byDay[day]?.sales), orders: num(byDay[day]?.orders) })),
    monthly: months.map(month => ({ month, sales: num(byMonth[month]?.sales), orders: num(byMonth[month]?.orders) })),
    byHour: Array.from({ length: 24 }, (_, h) => {
      const r = byHour.find(x => x.hour === h);
      return { hour: h, sales: num(r?.sales), orders: num(r?.orders) };
    }),
    // DAYOFWEEK: 1 = Sunday ... 7 = Saturday
    byWeekday: Array.from({ length: 7 }, (_, i) => {
      const r = byWeekday.find(x => x.dow === i + 1);
      return { dow: i + 1, sales: num(r?.sales), orders: num(r?.orders), days: num(r?.days) };
    }),
    items: items.map(r => ({ id: r.id, name: r.name, soldBy: r.sold_by, sales: num(r.sales), qty: num(r.qty), kg: num(r.kg) })),
  });
});

// ---------- Expenses ----------
reportsRouter.get('/expenses', async (req, res) => {
  const [from, to] = getRange(req.query);
  const [rows] = await pool.query(
    'SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ? ORDER BY expense_date DESC, id DESC', [from, to]
  );
  res.json(rows.map(r => ({ ...r, expense_date: ymd(r.expense_date) })));
});

function expenseFields(body) {
  const { expense_date, category, description, amount } = body;
  if (!isDate(expense_date) || !category?.trim() || !(Number(amount) > 0)) {
    throw Object.assign(new Error('Tarikh, category aur amount zaroori hain'), { status: 400 });
  }
  return [expense_date, category.trim(), description?.trim() || null, Number(amount)];
}

reportsRouter.post('/expenses', async (req, res) => {
  const [r] = await pool.query(
    'INSERT INTO expenses (expense_date, category, description, amount) VALUES (?, ?, ?, ?)', expenseFields(req.body)
  );
  res.status(201).json({ id: r.insertId });
});

reportsRouter.put('/expenses/:id', async (req, res) => {
  await pool.query(
    'UPDATE expenses SET expense_date = ?, category = ?, description = ?, amount = ? WHERE id = ?',
    [...expenseFields(req.body), req.params.id]
  );
  res.json({ ok: true });
});

reportsRouter.delete('/expenses/:id', async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});
