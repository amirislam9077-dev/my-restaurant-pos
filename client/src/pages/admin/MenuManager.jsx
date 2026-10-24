import { useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../orderTypes';
import { ItemImage } from '../../components/MenuPicker';

const EMPTY = { name: '', category: '', description: '', price: '', old_price: '', image: null, available: true };

// Shrink photo in the browser before upload (max 600px, JPEG) so the menu loads fast
function resizeImage(file, max = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Photo load nahi hui'));
    img.src = URL.createObjectURL(file);
  });
}

export default function MenuManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = () => api.menu(true).then(setItems);
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: k === 'available' ? e.target.checked : e.target.value }));

  const pickImage = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadImage(await resizeImage(file));
      setForm(f => ({ ...f, image: url }));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.updateMenuItem(editId, form);
      else await api.addMenuItem(form);
      setMsg(editId ? 'Item update ho gaya ✅' : 'Item add ho gaya ✅');
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const edit = (item) => {
    setEditId(item.id);
    setForm({
      name: item.name, category: item.category, description: item.description || '',
      price: item.price, old_price: item.old_price || '', image: item.image, available: !!item.available,
    });
    setMsg('');
    // On mobile the form sits above the list, bring it into view
    document.querySelector('.menu-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const remove = async (item) => {
    if (!confirm(`"${item.name}" delete karein?`)) return;
    const r = await api.deleteMenuItem(item.id);
    setMsg(r.hidden ? 'Purane orders mein use hua hai, isliye hide kar diya' : 'Delete ho gaya');
    load();
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="two-col">
      <section>
        <table className="data-table stack">
          <thead>
            <tr><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className={i.available ? '' : 'disabled'}>
                <td className="cell-photo"><ItemImage item={i} className="thumb" /></td>
                <td className="cell-title">{i.name}</td>
                <td data-label="Category">{i.category}</td>
                <td data-label="Price">{money(i.price)}</td>
                <td data-label="Status">{i.available ? '✅ Available' : '⛔ Hidden'}</td>
                <td className="row-actions">
                  <button className="btn-outline" onClick={() => edit(i)}>✏️ Edit</button>
                  <button className="btn-outline danger-text" onClick={() => remove(i)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form className="panel menu-form" onSubmit={save}>
        <h3>{editId ? '✏️ Edit Item' : '➕ Add Menu Item'}</h3>
        <label className="photo-pick">
          {form.image
            ? <img src={form.image} alt="" />
            : <span>{uploading ? 'Uploading...' : '📷 Photo select karein'}</span>}
          <input type="file" accept="image/*" onChange={pickImage} hidden />
        </label>
        {form.image && (
          <button type="button" className="link" onClick={() => setForm(f => ({ ...f, image: null }))}>Photo hatayein</button>
        )}
        <input placeholder="Item name" value={form.name} onChange={set('name')} />
        <input placeholder="Heading / Category (Our Burgers...)" list="cats" value={form.category} onChange={set('category')} />
        <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
        <textarea placeholder="Description (optional)" value={form.description} onChange={set('description')} />
        <div className="add-row">
          <input type="number" inputMode="decimal" placeholder="Price" value={form.price} onChange={set('price')} />
          <input type="number" inputMode="decimal" placeholder="Purani price (deal, optional)" value={form.old_price} onChange={set('old_price')} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.available} onChange={set('available')} /> Available (menu pe dikhe)
        </label>
        <button className="primary" type="submit" disabled={uploading}>{editId ? 'Update' : 'Add Item'}</button>
        {editId && <button type="button" className="link" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel edit</button>}
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}
