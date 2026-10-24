import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import OrderComposer from '../../components/OrderComposer';
import OrderCard from '../../components/OrderCard';
import { ORDER_TYPES, newestOrderId } from '../../orderTypes';

// Admin takes the order: takeaway (counter) or phone call
export default function CounterOrders({ type }) {
  const { orders, reload, setStatus } = useOutletContext();
  const [reorderFrom, setReorderFrom] = useState(null);
  const list = orders.filter(o => o.order_type === type);
  const newestId = newestOrderId(list);
  const info = ORDER_TYPES[type];

  return (
    <>
      <h3>{info.icon} New {info.label} Order</h3>
      <OrderComposer type={type} reorderFrom={reorderFrom} onSaved={reload} />

      {/* Takeaway is paid at the counter, so this only lists leftovers that still need payment */}
      {type === 'takeaway' ? (
        list.length > 0 && <h3>⏳ Pending {info.label} Orders ({list.length}) · payment baaki</h3>
      ) : (
        <>
          <h3>Active {info.label} Orders ({list.length})</h3>
          {!list.length && <p className="muted">Koi active order nahi</p>}
        </>
      )}
      <div className="orders">
        {list.map(o => <OrderCard key={o.id} order={o} onStatus={setStatus} onReorder={o2 => setReorderFrom({ ...o2 })} isNew={o.id === newestId} />)}
      </div>
    </>
  );
}
