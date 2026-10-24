const TOKEN_KEY = 'admin_token';

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  save: (token, username) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('admin_user', username);
  },
  user: () => localStorage.getItem('admin_user'),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('admin_user');
  },
};

async function request(url, options = {}) {
  const token = auth.token();
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401 && url !== '/api/auth/login') {
    auth.logout();
    // Everything except the customer pages (/table/..., /online) is admin
    const isCustomerPage = location.pathname.startsWith('/table/') || location.pathname === '/online';
    if (!isCustomerPage && location.pathname !== '/login') location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  changePassword: (oldPassword, newPassword) => request('/api/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } }),
  serverInfo: () => request('/api/server-info'),

  tables: () => request('/api/tables'),
  tableOrders: (id) => request(`/api/tables/${id}/orders`),
  closeTable: (id, paid_amount) => request(`/api/tables/${id}/close`, { method: 'POST', body: { paid_amount } }),

  menu: (all) => request(`/api/menu${all ? '?all=1' : ''}`),
  scaleItems: () => request('/api/menu?scale=1'),
  addMenuItem: (item) => request('/api/menu', { method: 'POST', body: item }),
  updateMenuItem: (id, item) => request(`/api/menu/${id}`, { method: 'PUT', body: item }),
  deleteMenuItem: (id) => request(`/api/menu/${id}`, { method: 'DELETE' }),
  waiters: (all) => request(`/api/waiters${all ? '?all=1' : ''}`),
  addWaiter: (w) => request('/api/waiters', { method: 'POST', body: w }),
  updateWaiter: (id, w) => request(`/api/waiters/${id}`, { method: 'PUT', body: w }),
  deleteWaiter: (id) => request(`/api/waiters/${id}`, { method: 'DELETE' }),
  report: (from, to) => request(`/api/reports?from=${from}&to=${to}`),
  trends: (from, to, scope, type) => request(`/api/reports/trends?from=${from}&to=${to}&scope=${scope}${type ? `&type=${type}` : ''}`),
  reportOrders: (from, to, type) => request(`/api/reports/orders?from=${from}&to=${to}${type ? `&type=${type}` : ''}`),
  expenses: (from, to) => request(`/api/expenses?from=${from}&to=${to}`),
  addExpense: (e) => request('/api/expenses', { method: 'POST', body: e }),
  updateExpense: (id, e) => request(`/api/expenses/${id}`, { method: 'PUT', body: e }),
  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: 'DELETE' }),
  uploadImage: (dataUrl) => request('/api/upload', { method: 'POST', body: { image: dataUrl } }),

  orders: (history) => request(`/api/orders${history ? '?history=1' : ''}`),
  order: (id) => request(`/api/orders/${id}`),
  track: (id) => request(`/api/track/${id}`),
  placeOrder: (body) => request('/api/orders', { method: 'POST', body }),
  setStatus: (id, status, paid_amount) => request(`/api/orders/${id}`, { method: 'PATCH', body: { status, paid_amount } }),
};
