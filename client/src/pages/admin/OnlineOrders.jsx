import { useOutletContext } from 'react-router-dom';
import OrderCard from '../../components/OrderCard';
import { newestOrderId } from '../../orderTypes';

export default function OnlineOrders() {
  const { orders, setStatus } = useOutletContext();
  const list = orders.filter(o => o.order_type === 'online');
  const newestId = newestOrderId(list);

  return (
    <>
      <h3>🌐 Online Orders (Website) · {list.length}</h3>
      <p className="muted">Customer website ke <b>/online</b> page se order karta hai, yahan aata hai.</p>
      {!list.length && <p className="muted">Koi active online order nahi</p>}
      <div className="orders">
        {list.map(o => <OrderCard key={o.id} order={o} onStatus={setStatus} isNew={o.id === newestId} />)}
      </div>
    </>
  );
}
