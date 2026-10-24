import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import MenuPicker, { CartSummary, CartBar, cartToItems } from '../components/MenuPicker';
import { statusText, money, orderCode } from '../orderTypes';

export default function TablePage() {
  const { id } = useParams();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [note, setNote] = useState('');
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');

  const loadOrders = useCallback(() => api.tableOrders(id).then(setOrders).catch(() => {}), [id]);

  useEffect(() => {
    api.menu().then(setMenu).catch(e => setMsg(e.message));
    loadOrders();
    const timer = setInterval(loadOrders, 5000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const placeOrder = async () => {
    try {
      await api.placeOrder({ order_type: 'dine_in', table_id: Number(id), note, items: cartToItems(cart) });
      setCart({});
      setNote('');
      setMsg('Order bhej diya gaya ✅');
      loadOrders();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const runningTotal = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);

  return (
    <>
      <h2>Table {id} · Menu</h2>
      <div className="two-col">
        <MenuPicker menu={menu} cart={cart} setCart={setCart} />

        <aside className="panel" id="cart">
          <h3>Your Order</h3>
          <CartSummary menu={menu} cart={cart} />
          <textarea placeholder="Note (e.g. kam mirch)" value={note} onChange={e => setNote(e.target.value)} />
          <button className="primary" disabled={!Object.keys(cart).length} onClick={placeOrder}>Place Order</button>
          {msg && <p className="msg">{msg}</p>}

          {orders.length > 0 && (
            <>
              <h3>Order Status</h3>
              {orders.map(o => (
                <div key={o.id} className="order-mini">
                  <div className="line">
                    <b>{orderCode(o)}</b>
                    <span className={`badge ${o.status}`}>{statusText(o)}</span>
                  </div>
                  <small>{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</small>
                </div>
              ))}
              <div className="line total"><span>Table bill so far</span><span>{money(runningTotal)}</span></div>
            </>
          )}
        </aside>
      </div>
      <CartBar menu={menu} cart={cart} targetId="cart" />
    </>
  );
}
