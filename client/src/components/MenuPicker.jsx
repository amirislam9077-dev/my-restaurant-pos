import { useState } from 'react';
import { money } from '../orderTypes';

const CATEGORY_ICONS = {
  all: '🍽️', main: '🍛', bread: '🫓', sides: '🥗', drinks: '🥤', dessert: '🍮',
  'fast food': '🍔', pizza: '🍕', roll: '🌯', bbq: '🍢', rice: '🍚', tea: '☕',
};
// Headings like "Our Burgers" / "Refreshing Drinks" are matched by keyword
const ICON_WORDS = [
  ['deal', '🔥'], ['burger', '🍔'], ['chicken', '🍗'], ['wrap', '🌯'], ['snack', '🌯'], ['side', '🍟'],
  ['drink', '🥤'], ['beverage', '🥤'], ['dessert', '🍨'], ['sweet', '🍨'], ['pizza', '🍕'], ['rice', '🍚'],
];
export const categoryIcon = (cat) => {
  const c = cat.toLowerCase();
  return CATEGORY_ICONS[c] || ICON_WORDS.find(([w]) => c.includes(w))?.[1] || '🍴';
};

export function ItemImage({ item, className = 'tile-img' }) {
  const [broken, setBroken] = useState(false);
  if (item.image && !broken) {
    return <img className={className} src={item.image} alt={item.name} loading="lazy" onError={() => setBroken(true)} />;
  }
  return <div className={`${className} placeholder`}>{categoryIcon(item.category)}</div>;
}

// "Today's Deals" -> Today's <red>Deals</red>
function Heading({ text }) {
  const words = text.split(' ');
  const last = words.pop();
  return <h2>{words.join(' ')} <span className="red">{last}</span></h2>;
}

// Picture menu: category chips + item tiles. cart = { [menuItemId]: qty }
// "All" shows every heading as its own section (tag + heading), like the website menu
export default function MenuPicker({ menu, cart, setCart }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const change = (itemId, delta) =>
    setCart(c => {
      const qty = Math.max(0, (c[itemId] || 0) + delta);
      const next = { ...c, [itemId]: qty };
      if (!qty) delete next[itemId];
      return next;
    });

  // menu arrives in heading order from the server, so Set keeps that order
  const categories = ['All', ...new Set(menu.map(m => m.category))];
  const shown = menu.filter(m =>
    (category === 'All' || m.category === category) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  );
  const sections = [...new Set(shown.map(m => m.category))].map(cat => ({
    cat,
    tag: shown.find(m => m.category === cat)?.category_tag,
    items: shown.filter(m => m.category === cat),
  }));

  const tile = (m) => {
    const qty = cart[m.id] || 0;
    return (
      <div key={m.id} className={`tile ${qty ? 'selected' : ''}`} onClick={() => change(m.id, 1)}>
        {qty > 0 && <span className="tile-badge">{qty}</span>}
        {m.old_price > m.price && <span className="tile-off">-{Math.round((1 - m.price / m.old_price) * 100)}%</span>}
        <ItemImage item={m} />
        <div className="tile-name">{m.name}</div>
        {m.description && <div className="tile-desc">{m.description}</div>}
        <div className="tile-price">
          {money(m.price)}
          {m.old_price > m.price && <s>{money(m.old_price)}</s>}
        </div>
        {qty > 0 && (
          <div className="tile-qty" onClick={e => e.stopPropagation()}>
            <button onClick={() => change(m.id, -1)}>−</button>
            <span>{qty}</span>
            <button onClick={() => change(m.id, 1)}>+</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="picker">
      <div className="picker-head">
        <input className="search" placeholder="🔍 Search" value={search} onChange={e => setSearch(e.target.value)} />
        {Object.keys(cart).length > 0 && (
          <button className="clear-cart" title="Clear" onClick={() => setCart({})}>🗑️</button>
        )}
      </div>

      <div className="chips">
        {categories.map(c => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            <span className="chip-icon">{categoryIcon(c)}</span>
            {c}
          </button>
        ))}
      </div>

      {sections.map(sec => (
        <div key={sec.cat} className="menu-section">
          <div className="menu-section-head">
            {sec.tag && <span className="section-tag">{sec.tag}</span>}
            <Heading text={sec.cat} />
          </div>
          <div className="menu-grid">{sec.items.map(tile)}</div>
        </div>
      ))}
      {!shown.length && <p className="muted">Koi item nahi mila</p>}
    </section>
  );
}

export function CartSummary({ menu, cart }) {
  const items = menu.filter(m => cart[m.id]);
  const total = items.reduce((s, m) => s + m.price * cart[m.id], 0);
  return (
    <>
      {!items.length && <p className="muted">Menu se items add karein</p>}
      {items.map(m => (
        <div key={m.id} className="line">
          <span>{m.name} × {cart[m.id]}</span>
          <span>{money(m.price * cart[m.id])}</span>
        </div>
      ))}
      <div className="line total"><span>Total</span><span>{money(total)}</span></div>
    </>
  );
}

// Mobile only: sticky bottom bar that jumps to the cart panel
export function CartBar({ menu, cart, targetId }) {
  const items = menu.filter(m => cart[m.id]);
  if (!items.length) return null;
  const count = items.reduce((s, m) => s + cart[m.id], 0);
  const total = items.reduce((s, m) => s + m.price * cart[m.id], 0);
  const jump = () => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <button className="cart-bar" onClick={jump}>
      <span>🛒 {count} item{count > 1 ? 's' : ''}</span>
      <b>{money(total)} · View Cart ↓</b>
    </button>
  );
}

export const cartToItems = (cart) =>
  Object.entries(cart).map(([id, qty]) => ({ menu_item_id: Number(id), qty }));
