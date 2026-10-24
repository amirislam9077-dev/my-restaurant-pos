import { useEffect, useState } from 'react';
import { api } from '../../api';

const EMPTY = { name: '', phone: '', active: true };

export default function Waiters() {
  const [waiters, setWaiters] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.waiters(true).then(setWaiters);
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: k === 'active' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.updateWaiter(editId, form);
      else await api.addWaiter(form);
      setMsg(editId ? 'Waiter update ho gaya ✅' : 'Waiter add ho gaya ✅');
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const edit = (w) => {
    setEditId(w.id);
    setForm({ name: w.name, phone: w.phone || '', active: !!w.active });
    setMsg('');
    document.querySelector('.waiter-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const remove = async (w) => {
    if (!confirm(`"${w.name}" ko hatayein?`)) return;
    const r = await api.deleteWaiter(w.id);
    setMsg(r.hidden ? 'Is waiter ke purane orders hain, isliye inactive kar diya' : 'Waiter hata diya');
    load();
  };

  return (
    <div className="two-col">
      <section>
        <table className="data-table stack">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {waiters.map(w => (
              <tr key={w.id} className={w.active ? '' : 'disabled'}>
                <td className="cell-title">🧑‍🍳 {w.name}</td>
                <td data-label="Phone">{w.phone || '-'}</td>
                <td data-label="Status">{w.active ? '✅ Active' : '⛔ Inactive'}</td>
                <td className="row-actions">
                  <button className="btn-outline" onClick={() => edit(w)}>✏️ Edit</button>
                  <button className="btn-outline danger-text" onClick={() => remove(w)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!waiters.length && <p className="muted">Abhi koi waiter nahi</p>}
      </section>

      <form className="panel menu-form waiter-form" onSubmit={save}>
        <h3>{editId ? '✏️ Edit Waiter' : '➕ Add Waiter'}</h3>
        <input placeholder="Waiter name *" value={form.name} onChange={set('name')} />
        <input type="tel" inputMode="tel" placeholder="Phone (optional)" value={form.phone} onChange={set('phone')} />
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={set('active')} /> Active (dropdown mein dikhe)
        </label>
        <button className="primary" type="submit">{editId ? 'Update' : 'Add Waiter'}</button>
        {editId && <button type="button" className="link" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel edit</button>}
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}
