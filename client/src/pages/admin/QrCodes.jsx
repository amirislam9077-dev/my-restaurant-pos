import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api';

export default function QrCodes() {
  const { tables } = useOutletContext();
  const [base, setBase] = useState(window.location.origin);

  // Use the PC's LAN IP so phones on the same WiFi can open the link
  useEffect(() => {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    api.serverInfo().then(({ ips }) => {
      if (ips.length) setBase(`${window.location.protocol}//${ips[0]}:${window.location.port}`);
    });
  }, []);

  return (
    <>
      <div className="section-head no-print">
        <div>
          <h3>🔳 Table QR Codes</h3>
          <p className="muted">Customer QR scan karega to seedha us table ka menu khulega. Phone aur PC same WiFi pe hon.</p>
          <label>Website address: <input className="inline" value={base} onChange={e => setBase(e.target.value)} /></label>
        </div>
        <button className="primary auto" onClick={() => window.print()}>🖨️ Print All</button>
      </div>
      <div className="qr-grid">
        {tables.map(t => (
          <div key={t.id} className="qr-card">
            <h2>{t.name}</h2>
            <QRCodeSVG value={`${base}/table/${t.id}`} size={170} />
            <p>Scan karke order karein</p>
            <small>{base}/table/{t.id}</small>
          </div>
        ))}
      </div>
    </>
  );
}
