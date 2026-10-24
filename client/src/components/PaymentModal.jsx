import { useState } from 'react';
import { money } from '../orderTypes';

// Ask how much cash the customer handed over, show the change, then offer print buttons.
// onConfirm(amount) must save the payment; renderDone(amount) returns the print buttons.
// breakdown: optional [[label, amount], ...] shown above the total (e.g. first order + reorders)
export default function PaymentModal({ title, subtitle, breakdown, total, onConfirm, onClose, renderDone }) {
  const [received, setReceived] = useState('');
  const [paid, setPaid] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = received === '' ? total : Number(received);
  const change = amount - total;
  const quickCash = [...new Set([total, Math.ceil(total / 100) * 100, 500, 1000, 2000, 5000])]
    .filter(v => v >= total).sort((a, b) => a - b).slice(0, 5);

  const confirm = async () => {
    if (change < 0 || busy) return;
    setBusy(true);
    try {
      await onConfirm(amount);
      setPaid(amount);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {paid === null ? (
          <>
            <div className="sheet-head">
              <b>💰 {title}</b>
              <button className="link" onClick={onClose}>✕</button>
            </div>
            {subtitle && <div className="paid-lines">{subtitle}</div>}
            {breakdown?.length > 1 && (
              <div className="pay-breakdown">
                {breakdown.map(([label, amt]) => (
                  <div key={label} className="line"><span>{label}</span><span>{money(amt)}</span></div>
                ))}
              </div>
            )}
            <div className="pay-total"><small>{breakdown?.length > 1 ? 'Total (sab orders)' : 'Total'}</small><b>{money(total)}</b></div>
            <label className="field">
              <span>Customer ne diye (Rs)</span>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                placeholder={String(total)}
                value={received}
                onChange={e => setReceived(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirm()}
              />
            </label>
            <div className="quick-cash">
              {quickCash.map(v => (
                <button key={v} className={amount === v ? 'active' : ''} onClick={() => setReceived(String(v))}>
                  {v === total ? 'Exact' : money(v)}
                </button>
              ))}
            </div>
            <div className={`change-due ${change < 0 ? 'short' : ''}`}>
              {change < 0 ? <>⚠️ {money(-change)} kam hain</> : <>Wapas dein: <b>{money(change)}</b></>}
            </div>
            {error && <p className="msg warn">{error}</p>}
            <button className="primary pay-btn" disabled={change < 0 || busy} onClick={confirm}>✅ Payment Receive</button>
          </>
        ) : (
          <>
            <div className="paid-head">✅ {title} · Paid</div>
            {subtitle && <div className="paid-lines">{subtitle}</div>}
            <div className="line"><span>Total</span><b>{money(total)}</b></div>
            <div className="line"><span>Received</span><span>{money(paid)}</span></div>
            <div className="line change-line"><span>Wapas dein</span><b>{money(paid - total)}</b></div>
            {renderDone?.(paid)}
            <button className="link new-order-link" onClick={onClose}>✓ Done</button>
          </>
        )}
      </div>
    </div>
  );
}
