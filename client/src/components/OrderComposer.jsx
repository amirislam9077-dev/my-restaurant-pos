import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import MenuPicker, { CartSummary, cartToItems } from './MenuPicker';
import { orderCode, money } from '../orderTypes';
import NotifyStatus from './NotifyStatus';

const EMPTY = { customer_name: '', customer_phone: '', customer_email: '', address: '', note: '' };
// Walk-in counter customers usually don't give a name
const CASH_CUSTOMER = 'Cash Customer';
const emptyForm = (type) => (type === 'takeaway' ? { ...EMPTY, customer_name: CASH_CUSTOMER } : EMPTY);
const NEW_WAITER = '__new__';
const isPhone = () => window.matchMedia('(max-width: 640px)').matches;

// Admin-side new order: picture menu + cart + print options.
// type = dine_in (needs tableId, waiter) | takeaway | phone
// reorderFrom = an earlier order to add more to (new object each click): same table/waiter/customer,
//   empty cart, old items shown for reference only, so the new order and its print hold only new items
export default function OrderComposer({ type, tableId, defaultWaiterId, reorderFrom, onSaved }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [waiterId, setWaiterId] = useState('');
  const [addingWaiter, setAddingWaiter] = useState(false);
  const [newWaiter, setNewWaiter] = useState('');
  const [cart, setCart] = useState({});
  const [form, setForm] = useState(() => emptyForm(type));
  const [msg, setMsg] = useState('');
  const [reference, setReference] = useState(null);
  const [saved, setSaved] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Counter takeaway: pay on the spot (no pending orders)
  const [payOpen, setPayOpen] = useState(false);
  const [received, setReceived] = useState('');
  const [paidOrder, setPaidOrder] = useState(null);
  const savedId = saved?.id;
  const isDineIn = type === 'dine_in';
  const isCounter = type === 'takeaway';

  useEffect(() => {
    api.menu().then(setMenu);
    if (isDineIn) api.waiters().then(setWaiters);
  }, [isDineIn]);

  // Quick-add a waiter without leaving the order screen; the new one gets selected
  const addWaiter = async () => {
    const name = newWaiter.trim();
    if (!name) return;
    try {
      const { id } = await api.addWaiter({ name });
      setWaiters(await api.waiters());
      setWaiterId(String(id));
      setNewWaiter('');
      setAddingWaiter(false);
      setMsg('');
    } catch (e) {
      setMsg(e.message);
    }
  };

  // Fresh cart when switching tab or table; keep the table's current waiter
  useEffect(() => {
    setCart({});
    setForm(emptyForm(type));
    setMsg('');
    setReference(null);
    setSaved(null);
    setWaiterId(defaultWaiterId ? String(defaultWaiterId) : '');
  }, [type, tableId]);

  // Reorder: start an add-on order for the same table / customer.
  // Declared after the reset effect so it wins when the table changes in the same click.
  useEffect(() => {
    if (!reorderFrom) return;
    const o = reorderFrom;
    setCart({});
    setReference(o);
    setForm({
      ...emptyForm(type),
      customer_name: o.customer_name || emptyForm(type).customer_name,
      customer_phone: o.customer_phone || '',
      customer_email: o.customer_email || '',
      address: o.address || '',
    });
    if (o.waiter_id) setWaiterId(String(o.waiter_id));
    setMsg('');
    setSaved(null);
    document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' });
  }, [reorderFrom]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const printOrder = (id, mode) => navigate(`/bill/order/${id}?print=${mode}&auto=1`);
  const print = (mode) => printOrder(savedId, mode);

  // Details that must be filled before saving; on phones the details sheet opens to fill them
  const missingDetails = () => {
    if (isDineIn && waiters.length && !waiterId) return '⚠️ Pehle waiter select karein';
    if (type === 'phone' && (!form.customer_name.trim() || !form.customer_phone.trim())) return '⚠️ Customer ka naam aur phone likhein';
    return '';
  };

  // andPrint: save, then go straight to the Kitchen + Customer print
  // payNow: counter takeaway, saved as paid with the cash received
  const save = async (andPrint = false, payNow = false) => {
    const missing = missingDetails();
    if (missing) {
      setMsg(missing);
      if (isPhone()) setSheetOpen(true);
      return;
    }
    try {
      const created = await api.placeOrder({
        order_type: type,
        table_id: tableId,
        waiter_id: isDineIn && waiterId ? Number(waiterId) : undefined,
        from_admin: true,
        ...form,
        customer_name: form.customer_name.trim() || emptyForm(type).customer_name,
        items: cartToItems(cart),
        ...(payNow ? { pay_now: true, paid_amount: received === '' ? undefined : Number(received) } : {}),
      });
      setCart({});
      setForm(emptyForm(type));
      setMsg('');
      setReference(null);
      // Remember what this order contained, so the print box can show exactly what will print
      const lines = menu.filter(m => cart[m.id]).map(m => `${m.name} × ${cart[m.id]}`);
      setSheetOpen(false);
      onSaved?.();
      if (payNow) {
        setPaidOrder({ ...created, lines, change: (created.paid_amount ?? created.total) - created.total });
        return;
      }
      setSaved({ ...created, lines });
      if (andPrint) navigate(`/bill/order/${created.id}?print=both&auto=1`);
    } catch (e) {
      setSaved(null);
      setMsg(e.message);
    }
  };

  const details = (
    <>
      {isDineIn && (
        <div className="field">
          <span>🧑‍🍳 Waiter *</span>
          <div className="waiter-row">
            <select
              className={!waiterId && msg ? 'invalid' : ''}
              value={waiterId}
              onChange={e => {
                if (e.target.value === NEW_WAITER) { setAddingWaiter(true); return; }
                setWaiterId(e.target.value);
                setMsg('');
              }}
            >
              <option value="">-- Waiter select karein --</option>
              {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              <option value={NEW_WAITER}>➕ Naya waiter add karein…</option>
            </select>
            <button type="button" className="add-waiter-btn" title="Naya waiter" onClick={() => setAddingWaiter(a => !a)}>➕</button>
          </div>
          {addingWaiter && (
            <div className="new-waiter">
              <input
                autoFocus
                placeholder="Naye waiter ka naam"
                value={newWaiter}
                onChange={e => setNewWaiter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWaiter()}
              />
              <button type="button" className="primary" onClick={addWaiter} disabled={!newWaiter.trim()}>Add</button>
              <button type="button" className="link" onClick={() => { setAddingWaiter(false); setNewWaiter(''); }}>✕</button>
            </div>
          )}
        </div>
      )}
      {/* Customer details: phone / WhatsApp and email get the order confirmation */}
      <div className="cust-fields">
        <input
          placeholder={type === 'phone' ? 'Customer name *' : isDineIn ? 'Customer name (optional)' : `Customer name (khaali = ${CASH_CUSTOMER})`}
          value={form.customer_name} onChange={set('customer_name')}
        />
        <input type="tel" inputMode="tel" placeholder={type === 'phone' ? '📱 Phone / WhatsApp *' : '📱 Phone / WhatsApp (optional)'}
          value={form.customer_phone} onChange={set('customer_phone')} />
        <input type="email" inputMode="email" placeholder="✉️ Email (optional)" value={form.customer_email} onChange={set('customer_email')} />
      </div>
      {type === 'phone' && (
        <textarea placeholder="Delivery address (khaali = customer khud lene aayega)" value={form.address} onChange={set('address')} />
      )}
      <textarea placeholder={type === 'dine_in' ? 'Note (e.g. kam mirch)' : 'Note'} value={form.note} onChange={set('note')} />
    </>
  );

  const itemCount = Object.values(cart).reduce((a, q) => a + q, 0);
  const cartTotal = menu.reduce((t, m) => t + (cart[m.id] || 0) * m.price, 0);
  const receivedNum = received === '' ? cartTotal : Number(received);
  const changeDue = receivedNum - cartTotal;
  const quickCash = [...new Set([cartTotal, Math.ceil(cartTotal / 100) * 100, 500, 1000, 2000, 5000])]
    .filter(v => v >= cartTotal).sort((a, b) => a - b).slice(0, 5);
  const openPay = () => {
    const missing = missingDetails();
    if (missing) { setMsg(missing); if (isPhone()) setSheetOpen(true); return; }
    setReceived('');
    setMsg('');
    setSheetOpen(false);
    setPayOpen(true);
  };
  const closePay = () => { setPayOpen(false); setPaidOrder(null); setMsg(''); };

  const detailsLabel = isDineIn
    ? (waiters.find(w => String(w.id) === waiterId)?.name || 'Waiter')
    : (form.customer_name.trim() || 'Customer');

  return (
    <>
      <div className="two-col" id="composer">
        <MenuPicker menu={menu} cart={cart} setCart={setCart} />
        <aside className="panel" id="cart">
          {tableId && <h3>🍽️ Table {tableId}</h3>}
          {reference && (
            <div className="reorder-ref">
              <div className="line">
                <b>🔁 {orderCode(reference)} mein pehle se</b>
                <button className="link" onClick={() => setReference(null)} title="Hatayein">✕</button>
              </div>
              <ul>
                {reference.items.map(i => <li key={i.menu_item_id}>{i.name} × {i.qty}</li>)}
              </ul>
              <small>Sirf naye items add karein. Naye order aur print mein sirf naye items honge.</small>
              <button
                className="btn-outline"
                onClick={() => setCart(Object.fromEntries(reference.items.map(i => [i.menu_item_id, i.qty])))}
              >
                ↺ Yahi sab dobara add karein
              </button>
            </div>
          )}
          {details}
          <CartSummary menu={menu} cart={cart} />
          {isCounter ? (
            <button className="primary pay-btn" disabled={!itemCount} onClick={openPay}>💰 Receive Payment</button>
          ) : (
            <div className="add-row">
              <button className="primary" disabled={!itemCount} onClick={() => save()}>Add Order</button>
              <button className="btn-outline" disabled={!itemCount} onClick={() => save(true)}>🖨️ Add Order &amp; Print</button>
            </div>
          )}
          {msg && <p className="msg warn">{msg}</p>}
          {savedId && (
            <div className="print-box">
              <div className="print-box-head">
                <b>✅ Order {orderCode(saved)} add ho gaya</b>
                <button className="link" onClick={() => setSaved(null)}>✕</button>
              </div>
              <div className="print-box-items">
                <small>Print mein sirf is order ke items:</small>
                <div>{saved.lines.join(', ')}</div>
              </div>
              <NotifyStatus notify={saved.notify} />
              <button className="primary print-both-btn" onClick={() => print('both')}><b>🖨️ Print Both</b><small>Kitchen + Customer</small></button>
              <div className="print-box-row">
                <button className="btn-outline" onClick={() => print('kot')}>🍳 Kitchen</button>
                <button className="btn-outline" onClick={() => print('bill')}>🧾 Customer</button>
              </div>
            </div>
          )}
        </aside>
      </div>
      {/* Phone-only POS bar: details sheet, cart, save + print */}
      <div className="pos-bar">
        <button className={`pos-btn ${msg && !sheetOpen ? 'attention' : ''}`} onClick={() => setSheetOpen(true)}>
          <span>{isDineIn ? '🧑‍🍳' : '👤'}</span>
          <small>{detailsLabel}</small>
        </button>
        <button className="pos-cart" onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' })}>
          <small>🛒 {itemCount} item{itemCount === 1 ? '' : 's'}</small>
          <b>{money(cartTotal)}</b>
        </button>
        {isCounter ? (
          <button className="pos-print" disabled={!itemCount} onClick={openPay}>
            <span>💰</span>
            <small>Pay</small>
          </button>
        ) : (
          <button className="pos-print" disabled={!itemCount} onClick={() => save(true)}>
            <span>🖨️</span>
            <small>Print</small>
          </button>
        )}
      </div>

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <b>{isDineIn ? `🧑‍🍳 Table ${tableId} · Waiter & Note` : '👤 Customer Details'}</b>
              <button className="link" onClick={() => setSheetOpen(false)}>✕</button>
            </div>
            {details}
            {msg && <p className="msg warn">{msg}</p>}
            <div className="add-row">
              <button className="btn-outline" onClick={() => { setSheetOpen(false); setMsg(''); }}>✓ Done</button>
              {isCounter
                ? <button className="primary" disabled={!itemCount} onClick={openPay}>💰 Receive Payment</button>
                : <button className="primary" disabled={!itemCount} onClick={() => save(true)}>🖨️ Order &amp; Print</button>}
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <div className="modal-backdrop" onClick={paidOrder ? closePay : () => setPayOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {!paidOrder ? (
              <>
                <div className="sheet-head">
                  <b>💰 Receive Payment</b>
                  <button className="link" onClick={() => setPayOpen(false)}>✕</button>
                </div>
                <div className="pay-total"><small>Total</small><b>{money(cartTotal)}</b></div>
                <label className="field">
                  <span>Customer ne diye (Rs)</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    placeholder={String(cartTotal)}
                    value={received}
                    onChange={e => setReceived(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && changeDue >= 0 && save(false, true)}
                  />
                </label>
                <div className="quick-cash">
                  {quickCash.map(v => (
                    <button key={v} className={receivedNum === v ? 'active' : ''} onClick={() => setReceived(String(v))}>
                      {v === cartTotal ? 'Exact' : money(v)}
                    </button>
                  ))}
                </div>
                <div className={`change-due ${changeDue < 0 ? 'short' : ''}`}>
                  {changeDue < 0 ? <>⚠️ {money(-changeDue)} kam hain</> : <>Wapas dein: <b>{money(changeDue)}</b></>}
                </div>
                {msg && <p className="msg warn">{msg}</p>}
                <button className="primary pay-btn" disabled={changeDue < 0} onClick={() => save(false, true)}>✅ Payment Receive</button>
              </>
            ) : (
              <>
                <div className="paid-head">✅ {orderCode(paidOrder)} · Paid</div>
                <div className="paid-lines">{paidOrder.lines.join(', ')}</div>
                <div className="line"><span>Total</span><b>{money(paidOrder.total)}</b></div>
                <div className="line"><span>Received</span><span>{money(paidOrder.paid_amount ?? paidOrder.total)}</span></div>
                <div className="line change-line"><span>Wapas dein</span><b>{money(paidOrder.change)}</b></div>
                <NotifyStatus notify={paidOrder.notify} />
                {/* One button: kitchen slip + customer bill come out together */}
                <button className="primary pay-btn" onClick={() => printOrder(paidOrder.id, 'both')}>🖨️ Print</button>
                <button className="link new-order-link" onClick={closePay}>➕ Naya Order</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
