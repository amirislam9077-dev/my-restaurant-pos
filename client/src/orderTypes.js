export const ORDER_TYPES = {
  dine_in: { label: 'Dine-In', icon: '🍽️', prefix: 'D' },
  takeaway: { label: 'Takeaway', icon: '🥡', prefix: 'T' },
  phone: { label: 'Phone Call', icon: '📞', prefix: 'P' },
  online: { label: 'Online', icon: '🌐', prefix: 'O' },
};

// Daily order number shown to staff and customers: D-01, T-01, P-01, O-01
export function orderCode(order) {
  const prefix = ORDER_TYPES[order.order_type]?.prefix || '#';
  return `${prefix}-${String(order.order_no ?? order.id).padStart(2, '0')}`;
}

// Customer-facing status text per order type
export function statusText(order) {
  const delivery = order.order_type === 'phone' || order.order_type === 'online';
  return {
    pending: 'New · waiting',
    accepted: 'Preparing',
    served: order.order_type === 'dine_in' ? 'Served' : delivery && order.address ? 'Out for delivery' : 'Ready',
    paid: 'Paid',
    cancelled: 'Cancelled',
  }[order.status];
}

// Admin next-step buttons per status
export function nextActions(order) {
  // Counter takeaway is closed by taking payment, never left pending
  if (order.order_type === 'takeaway' && ['pending', 'accepted', 'served'].includes(order.status)) {
    return [['paid', '💰 Receive Payment'], ['cancelled', 'Cancel']];
  }
  const done = order.order_type === 'dine_in' ? 'Mark Served'
    : order.order_type === 'takeaway' || !order.address ? 'Mark Ready' : 'Dispatched';
  return {
    pending: [['accepted', 'Accept'], ['cancelled', 'Reject']],
    accepted: [['served', done], ['cancelled', 'Cancel']],
    served: [['paid', 'Mark Paid']],
  }[order.status] || [];
}

// Only the latest order of a list gets the NEW highlight, and only for 2 minutes
// (admin lists re-render every 5s, so it fades on its own)
const NEW_FOR_MS = 2 * 60 * 1000;
export function newestOrderId(orders) {
  const latest = orders.reduce((a, o) => (!a || o.id > a.id ? o : a), null);
  if (!latest) return null;
  return Date.now() - new Date(latest.created_at).getTime() < NEW_FOR_MS ? latest.id : null;
}

export const money =(n) => `Rs ${Number(n).toLocaleString('en-PK')}`;
