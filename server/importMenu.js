// Imports the menu from seed/cfc-menu.json (headings + items, photos in uploads/cfc/).
// Items already on the menu are updated; old items not in the file are hidden (kept for past orders).
// Run: npm run menu:import
import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

const sections = JSON.parse(fs.readFileSync(new URL('./seed/cfc-menu.json', import.meta.url), 'utf8'));
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  const keep = [];
  let order = 0;
  for (const [i, s] of sections.entries()) {
    await conn.query(
      `INSERT INTO menu_categories (name, tag, sort_order) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tag = VALUES(tag), sort_order = VALUES(sort_order)`,
      [s.heading, s.tag, i + 1]
    );
    for (const item of s.items) {
      order += 1;
      const image = `/uploads/cfc/${path.basename(item.img)}`;
      const [found] = await conn.query('SELECT id FROM menu_items WHERE name = ? AND category = ?', [item.name, s.heading]);
      const fields = [item.desc, item.price, item.oldPrice, image, order];
      if (found.length) {
        await conn.query(
          'UPDATE menu_items SET description = ?, price = ?, old_price = ?, image = ?, sort_order = ?, available = 1 WHERE id = ?',
          [...fields, found[0].id]
        );
        keep.push(found[0].id);
      } else {
        const [r] = await conn.query(
          'INSERT INTO menu_items (name, category, description, price, old_price, image, sort_order, available) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [item.name, s.heading, ...fields]
        );
        keep.push(r.insertId);
      }
    }
  }
  const [hidden] = await conn.query('UPDATE menu_items SET available = 0 WHERE id NOT IN (?) AND available = 1', [keep]);
  await conn.commit();
  console.log(`Menu imported: ${sections.length} headings, ${keep.length} items. Old items hidden: ${hidden.affectedRows}`);
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
  await pool.end();
}
