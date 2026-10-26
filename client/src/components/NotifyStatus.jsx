// Shows whether the order confirmation went out by WhatsApp / Email; offers one-click manual send otherwise
const LABEL = {
  sent: '✅ bhej diya',
  failed: '⚠️ nahi gaya',
  not_configured: '',
};

export default function NotifyStatus({ notify }) {
  if (!notify) return null;
  const rows = [
    notify.whatsapp !== 'skipped' && { key: 'wa', name: '📲 WhatsApp', state: notify.whatsapp, link: notify.waLink, button: '📲 WhatsApp pe bhejein' },
    notify.email !== 'skipped' && { key: 'mail', name: '✉️ Email', state: notify.email, link: notify.mailtoLink, button: '✉️ Email bhejein' },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="notify-box">
      <small>Customer ko order ka message:</small>
      {rows.map(r => (
        // 'sending' = going out automatically in the background
        r.state === 'sent' || r.state === 'sending'
          ? <div key={r.key} className="notify-row sent">{r.name} {LABEL.sent}</div>
          : (
            <a key={r.key} className="notify-row btn-outline" href={r.link} target="_blank" rel="noreferrer">
              {r.state === 'failed' ? `${r.name} ${LABEL.failed} · dobara: ` : ''}{r.button} →
            </a>
          )
      ))}
    </div>
  );
}
