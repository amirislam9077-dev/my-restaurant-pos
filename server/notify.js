// Order confirmation to the customer by Email (SMTP) and WhatsApp (Meta WhatsApp Cloud API).
// Both are optional: fill the settings in .env to send automatically. Without them the admin
// screen gets a ready message and opens WhatsApp / the mail app instead (see waLink / mailtoLink).
import nodemailer from 'nodemailer';
import './env.js';

const RESTAURANT = process.env.RESTAURANT_NAME || 'My Restaurant';
const TYPE_LABEL = { dine_in: 'Dine-In', takeaway: 'Takeaway', phone: 'Phone order', online: 'Online order' };
const PREFIX = { dine_in: 'D', takeaway: 'T', phone: 'P', online: 'O' };

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');

// Pakistani numbers: 0300-1234567 -> 923001234567 (WhatsApp needs country code, digits only)
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = (process.env.WHATSAPP_COUNTRY_CODE || '92') + d.slice(1);
  return d.length >= 10 ? d : '';
}

export function orderMessage(order, lines) {
  const code = `${PREFIX[order.order_type] || '#'}-${String(order.order_no).padStart(2, '0')}`;
  const where = order.table_id ? `Table ${order.table_id}` : TYPE_LABEL[order.order_type];
  const items = lines.map(l => `• ${l.name} × ${l.qty} = Rs ${Math.round(l.price * l.qty).toLocaleString('en-PK')}`).join('\n');
  const subject = `${RESTAURANT} · Order ${code} confirmed`;
  const text = [
    `Assalam o Alaikum${order.customer_name ? ' ' + order.customer_name : ''}!`,
    '',
    `Aapka order ${code} (${where}) ${RESTAURANT} mein mil gaya hai.`,
    '',
    items,
    '',
    `Total: Rs ${Math.round(order.total).toLocaleString('en-PK')}`,
    order.status === 'paid' ? 'Payment: Paid ✅' : '',
    '',
    'Shukriya! 🙏',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  return { code, subject, text };
}

const smtpReady = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
const waReady = () => process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID;

async function sendEmail(to, subject, text) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM || `"${RESTAURANT}" <${process.env.SMTP_USER}>`, to, subject, text });
}

async function sendWhatsApp(number, text) {
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: number, type: 'text', text: { body: text } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Returns per-channel result: 'sent' | 'failed' | 'not_configured' | 'skipped' (no address given),
// plus ready links so the admin can send it by hand when automatic sending isn't set up.
export async function notifyCustomer(order, lines) {
  const { subject, text } = orderMessage(order, lines);
  const number = waNumber(order.customer_phone);
  const email = isEmail(order.customer_email) ? order.customer_email : '';
  const result = {
    email: email ? 'not_configured' : 'skipped',
    whatsapp: number ? 'not_configured' : 'skipped',
    waLink: number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null,
    mailtoLink: email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : null,
  };
  const jobs = [];
  if (email && smtpReady()) {
    jobs.push(sendEmail(email, subject, text).then(() => { result.email = 'sent'; })
      .catch(e => { result.email = 'failed'; result.emailError = e.message; console.error('Email failed:', e.message); }));
  }
  if (number && waReady()) {
    jobs.push(sendWhatsApp(number, text).then(() => { result.whatsapp = 'sent'; })
      .catch(e => { result.whatsapp = 'failed'; result.whatsappError = e.message; console.error('WhatsApp failed:', e.message); }));
  }
  await Promise.all(jobs);
  return result;
}
