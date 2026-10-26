import { useEffect, useState } from 'react';
import { api } from '../api';
import MenuPicker, { CartBar, cartToItems } from '../components/MenuPicker';
import { statusText, money, orderCode } from '../orderTypes';

const DELIVERY_FEE = 150;
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Hyderabad', 'Peshawar', 'Other'];
const PAYMENTS = [
  ['Cash on Delivery', '💵'],
  ['Debit / Credit Card', '💳'],
  ['JazzCash / Easypaisa', '📱'],
];
const EMPTY = {
  customer_name: '', customer_phone: '', customer_email: '',
  street: '', area: '', city: 'Karachi', landmark: '', notes: '',
};

// Customer website order, CFC-style checkout: Home Delivery / Takeaway, address, payment
export default function OnlineOrder() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [orderType, setOrderType] = useState('Home Delivery');
  const [payment, setPayment] = useState(PAYMENTS[0][0]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
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

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setMsg(''); };
  const delivery = orderType === 'Home Delivery';
  const lines = menu.filter(m => cart[m.id]);
  const subtotal = lines.reduce((s, m) => s + m.price * cart[m.id], 0);
  const fee = delivery && lines.length ? DELIVERY_FEE : 0;
  const pieces = lines.reduce((s, m) => s + cart[m.id], 0);

  const missing = () => {
    if (!form.customer_name.trim()) return 'Apna naam likhein';
    if (!/^[0-9+\-\s]{10,15}$/.test(form.customer_phone.trim())) return 'Sahi phone number likhein (03XX-XXXXXXX)';
    if (form.customer_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) return 'Email sahi nahi hai';
    if (delivery && (!form.street.trim() || !form.area.trim())) return 'Delivery ke liye address aur area likhein';
    return '';
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    const problem = missing();
    if (problem) return setMsg('⚠️ ' + problem);
    setBusy(true);
    setMsg('');
    const address = delivery
      ? [form.street, form.area, form.city].map(s => s.trim()).filter(Boolean).join(', ')
      : 'Takeaway - customer khud lega';
    const note = [
      orderType, payment,
      delivery ? `Delivery fee Rs ${DELIVERY_FEE}` : null,
      form.landmark.trim() && `Landmark: ${form.landmark.trim()}`,
      form.notes.trim(),
    ].filter(Boolean).join(' · ').slice(0, 255);
    try {
      const created = await api.placeOrder({
        order_type: 'online',
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        address, note,
        items: cartToItems(cart),
      });
      localStorage.setItem('online_order_id', created.id);
      setTrackId(String(created.id));
      setDone({
        code: orderCode(created), name: form.customer_name.trim(), type: orderType, payment,
        total: created.total + fee, address: delivery ? address : '', phone: form.customer_phone.trim(),
        email: form.customer_email.trim(),
      });
      setCart({});
      setForm(EMPTY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMsg('⚠️ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="ok-card">
        <div className="ok-icon">✓</div>
        <h2>Thank You, {done.name}!</h2>
        <p className="muted">Aapka order restaurant ko mil gaya hai.</p>
        <div className="ok-details">
          <div><span>Order Number</span><b>{done.code}</b></div>
          <div><span>Order Type</span><b>{done.type}</b></div>
          <div><span>Payment</span><b>{done.payment}</b></div>
          <div><span>Grand Total</span><b>{money(done.total)}</b></div>
          {done.address && <div><span>Deliver To</span><b>{done.address}</b></div>}
        </div>
        <p className="muted">
          Contact: <b>{done.phone}{done.email && ` / ${done.email}`}</b> · Estimated time: <b>{done.type === 'Home Delivery' ? '30-45 minutes' : '15 minutes'}</b>
        </p>
        {tracked && tracked.status !== 'paid' && (
          <p className="ok-status">Status: <span className={`badge ${tracked.status}`}>{statusText({ ...tracked, order_type: 'online', address: done.address || '' })}</span></p>
        )}
        <button className="primary" onClick={() => setDone(null)}>🍗 Naya Order</button>
      </div>
    );
  }

  return (
    <>
      <div className="co-hero">
        <h2>🛵 Online Order</h2>
        <p>Menu se items chunein, phir neeche apni detail likh kar order karein</p>
      </div>
      <div className="two-col">
        <MenuPicker menu={menu} cart={cart} setCart={setCart} />

        <form className="panel co-panel" id="cart" onSubmit={placeOrder}>
          <h3>Order Summary</h3>
          {!lines.length && <p className="muted">Menu se items add karein</p>}
          {lines.map(m => (
            <div key={m.id} className="line"><span>{m.name} × {cart[m.id]}</span><span>{money(m.price * cart[m.id])}</span></div>
          ))}
          <div className="co-sums">
            <div className="line"><span>Items</span><span>{lines.length} · {pieces} pcs</span></div>
            <div className="line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="line"><span>Delivery Fee</span><span>{fee ? money(fee) : 'Free'}</span></div>
            <div className="line total"><span>Grand Total</span><span>{money(subtotal + fee)}</span></div>
          </div>

          <div className="co-step"><b>1</b> Order Type</div>
          <div className="co-choices">
            {[['Home Delivery', '🛵'], ['Takeaway', '🏪']].map(([t, icon]) => (
              <button type="button" key={t} className={orderType === t ? 'active' : ''} onClick={() => setOrderType(t)}>{icon} {t}</button>
            ))}
          </div>

          <div className="co-step"><b>2</b> Your Details</div>
          <input autoComplete="name" placeholder="Full Name *" value={form.customer_name} onChange={set('customer_name')} />
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone Number * (03XX-XXXXXXX)" value={form.customer_phone} onChange={set('customer_phone')} />
          <input type="email" inputMode="email" autoComplete="email" placeholder="Email (order confirmation ke liye)" value={form.customer_email} onChange={set('customer_email')} />

          {delivery && (
            <>
              <div className="co-step"><b>3</b> Delivery Address</div>
              <input autoComplete="street-address" placeholder="Street Address * (House #, Street, Block)" value={form.street} onChange={set('street')} />
              <div className="co-row">
                <input placeholder="Area *" value={form.area} onChange={set('area')} />
                <select value={form.city} onChange={set('city')}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input placeholder="Nearest Landmark (optional)" value={form.landmark} onChange={set('landmark')} />
            </>
          )}

          <div className="co-step"><b>{delivery ? 4 : 3}</b> Payment Method</div>
          <div className="co-choices col">
            {PAYMENTS.map(([p, icon]) => (
              <button type="button" key={p} className={payment === p ? 'active' : ''} onClick={() => setPayment(p)}>{icon} {p}</button>
            ))}
          </div>
          <textarea placeholder="Special Instructions (e.g. extra ketchup)" value={form.notes} onChange={set('notes')} />

          {msg && <p className="msg warn">{msg}</p>}
          <button className="primary pay-btn" type="submit" disabled={!lines.length || busy}>
            {busy ? 'Order bhej rahe hain…' : `✅ Place Order · ${money(subtotal + fee)}`}
          </button>
        </form>
      </div>
      <CartBar menu={menu} cart={cart} targetId="cart" />
    </>
  );
}
