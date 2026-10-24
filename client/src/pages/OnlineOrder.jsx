import { useEffect, useState } from 'react';
import { api } from '../api';
import MenuPicker, { CartSummary, CartBar, cartToItems } from '../components/MenuPicker';
import { statusText, money, orderCode } from '../orderTypes';

// Customer website order (delivery)
export default function OnlineOrder() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', customer_email: '', address: '', note: '' });
  const [msg, setMsg] = useState('');
  const [trackId, setTrackId] = useState(() => localStorage.getItem('online_order_id'));
  const [tracked, setTracked] = useState(null);

  useEffect(() => {
    api.menu().then(setMenu).catch(e => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (!trackId) return;
    const load = () => api.track(trackId).then(setTracked).catch(() => setTracked(null));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [trackId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    try {
      const created = await api.placeOrder({ order_type: 'online', ...form, items: cartToItems(cart) });
      localStorage.setItem('online_order_id', created.id);
      setTrackId(String(created.id));
      setCart({});
      setMsg(`Order ${orderCode(created)} place ho gaya ✅`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <h2>🌐 Online Order · Home Delivery</h2>
      <div className="two-col">
        <MenuPicker menu={menu} cart={cart} setCart={setCart} />
        <aside className="panel" id="cart">
          <h3>Your Order</h3>
          <CartSummary menu={menu} cart={cart} />
          <input autoComplete="name" placeholder="Your name *" value={form.customer_name} onChange={set('customer_name')} />
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone number *" value={form.customer_phone} onChange={set('customer_phone')} />
          <input type="email" inputMode="email" autoComplete="email" placeholder="Email (optional, order confirmation ke liye)" value={form.customer_email} onChange={set('customer_email')} />
          <textarea placeholder="Delivery address *" value={form.address} onChange={set('address')} />
          <textarea placeholder="Note (optional)" value={form.note} onChange={set('note')} />
          <button className="primary" disabled={!Object.keys(cart).length} onClick={placeOrder}>Place Order</button>
          {msg && <p className="msg">{msg}</p>}

          {tracked && tracked.status !== 'paid' && (
            <div className="track">
              <h3>Order {orderCode(tracked)} Status</h3>
              <span className={`badge ${tracked.status}`}>{statusText({ ...tracked, order_type: 'online', address: 'x' })}</span>
              <p><small>{tracked.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</small></p>
              <b>{money(tracked.total)}</b>
            </div>
          )}
        </aside>
      </div>
      <CartBar menu={menu} cart={cart} targetId="cart" />
    </>
  );
}
