import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { Kpi, Share, rs, short, pct } from './shared';

const CATEGORIES = ['Groceries', 'Salary', 'Rent', 'Electricity / Gas / Water', 'Maintenance', 'Packing', 'Other'];
const today = () => new Date().toLocaleDateString('en-CA');
const EMPTY = { expense_date: today(), category: '', description: '', amount: '' };

export default function Expenses() {
  const { report, from, to, reload } = useOutletContext();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.expenses(from, to).then(setList);
  useEffect(() => { load(); }, [from, to]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.updateExpense(editId, form);
      else await api.addExpense(form);
      setMsg(editId ? 'Expense updated ✅' : 'Expense added ✅');
      setForm({ ...EMPTY, expense_date: form.expense_date });
      setEditId(null);
      load();
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const edit = (x) => {
    setEditId(x.id);
    setForm({ expense_date: x.expense_date, category: x.category, description: x.description || '', amount: x.amount });
    setMsg('');
    document.querySelector('.exp-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const remove = async (x) => {
    if (!confirm(`${x.category} · ${rs(x.amount)} delete this expense?`)) return;
    await api.deleteExpense(x.id);
    load();
    reload();
  };

  const total = report.summary.expenses;
  const cats = report.expenseByCategory;

  return (
    <>
      <div className="kpis">
        <Kpi label="🧾 Total Expenses" value={rs(total)} note={`${list.length} entries`} />
        <Kpi label="📦 Biggest expense" value={cats[0] ? rs(cats[0].amount) : "-"} note={cats[0]?.category || ""} />
        <Kpi label="💰 Sales (same period)" value={rs(report.summary.sales)} />
      </div>

      <div className="rep-grid two">
        <form className="rep-card exp-form" onSubmit={save}>
          <h3>{editId ? '✏️ Edit expense' : '➕ New expense'}</h3>
          <label className="field"><span>Date</span><input type="date" value={form.expense_date} onChange={set('expense_date')} /></label>
          <label className="field">
            <span>Category</span>
            <input list="exp-cats" placeholder="e.g. Groceries" value={form.category} onChange={set('category')} />
            <datalist id="exp-cats">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field"><span>Detail (optional)</span><input placeholder="e.g. 20kg chicken, 5L oil" value={form.description} onChange={set('description')} /></label>
          <label className="field"><span>Amount (Rs)</span><input type="number" inputMode="numeric" min="1" value={form.amount} onChange={set('amount')} /></label>
          <div className="add-row">
            <button className="primary" type="submit">{editId ? 'Update' : 'Add Expense'}</button>
            {editId && <button type="button" className="btn-outline" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
          </div>
          {msg && <p className="msg">{msg}</p>}
        </form>

        <section className="rep-card">
          <h3>Expenses by category</h3>
          <table className="rep-table">
            <thead><tr><th>Category</th><th>Entries</th><th>Amount</th><th>Share</th></tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c.category}>
                  <td>{c.category}</td><td>{c.entries}</td><td>{rs(c.amount)}</td>
                  <td><Share value={c.amount} max={total} /> {pct(c.amount, total)}%</td>
                </tr>
              ))}
              {!cats.length && <tr><td colSpan={4} className="muted">No expenses in this period</td></tr>}
            </tbody>
            {cats.length > 0 && <tfoot><tr><td>Total</td><td>{list.length}</td><td>{rs(total)}</td><td /></tr></tfoot>}
          </table>
        </section>
      </div>

      <section className="rep-card">
        <h3>All expenses</h3>
        <table className="rep-table">
          <thead><tr><th>Date</th><th>Category</th><th className="hide-sm">Detail</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {list.map(x => (
              <tr key={x.id} className={editId === x.id ? 'selected' : ''}>
                <td>{short(x.expense_date)}</td><td>{x.category}</td><td className="muted hide-sm">{x.description || '-'}</td><td>{rs(x.amount)}</td>
                <td className="row-actions">
                  <button className="btn-outline" onClick={() => edit(x)}>✏️</button>
                  <button className="btn-outline danger-text" onClick={() => remove(x)}>🗑️</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="muted">No expenses recorded yet. Add one with the form above.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
