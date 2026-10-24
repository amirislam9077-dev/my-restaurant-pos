import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import TablePage from './pages/TablePage';
import OnlineOrder from './pages/OnlineOrder';
import Login from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import DineIn from './pages/admin/DineIn';
import CounterOrders from './pages/admin/CounterOrders';
import OnlineOrders from './pages/admin/OnlineOrders';
import MenuManager from './pages/admin/MenuManager';
import QrCodes from './pages/admin/QrCodes';
import History from './pages/admin/History';
import Waiters from './pages/admin/Waiters';
import BillPage from './pages/admin/BillPage';
import ReportsLayout from './pages/reports/ReportsLayout';
import Dashboard from './pages/reports/Dashboard';
import SalesReport from './pages/reports/SalesReport';
import OrdersReport from './pages/reports/OrdersReport';
import Scale from './pages/reports/Scale';
import WaiterReport from './pages/reports/WaiterReport';
import Expenses from './pages/reports/Expenses';
import ProfitLoss from './pages/reports/ProfitLoss';
import { auth } from './api';

function RequireAuth({ children }) {
  return auth.token() ? children : <Navigate to="/login" replace />;
}

// Customer pages (QR table menu, online order) keep the website header
function CustomerPage({ children }) {
  return (
    <>
      <header className="topbar no-print">
        <span className="brand">🍽️ My Restaurant</span>
        <nav>
          <Link to="/online">Order Online</Link>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

// Old /admin/... links and bookmarks: admin now lives at the site root
function OldAdminRedirect() {
  const { pathname, search } = useLocation();
  const rest = pathname.replace(/^\/admin/, '') || '/';
  return <Navigate to={(rest === '/online' ? '/online-orders' : rest) + search} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Customer side */}
      <Route path="/table/:id" element={<CustomerPage><TablePage /></CustomerPage>} />
      <Route path="/online" element={<CustomerPage><OnlineOrder /></CustomerPage>} />

      {/* Admin = home page */}
      <Route path="/login" element={
        <>
          <header className="topbar"><span className="brand">🍽️ My Restaurant</span></header>
          <main className="container"><Login /></main>
        </>
      } />
      <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<DineIn />} />
        <Route path="takeaway" element={<CounterOrders type="takeaway" />} />
        <Route path="phone" element={<CounterOrders type="phone" />} />
        <Route path="online-orders" element={<OnlineOrders />} />
        <Route path="menu" element={<MenuManager />} />
        <Route path="waiters" element={<Waiters />} />
        <Route path="qr" element={<QrCodes />} />
        <Route path="history" element={<History />} />
        <Route path="bill/:kind/:id" element={<BillPage />} />
      </Route>
      {/* Owner reports with a left navbar */}
      <Route path="/reports" element={<RequireAuth><ReportsLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="sales" element={<SalesReport />} />
        <Route path="orders" element={<OrdersReport />} />
        <Route path="scale" element={<Scale />} />
        <Route path="waiters" element={<WaiterReport />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="profit" element={<ProfitLoss />} />
      </Route>
      <Route path="/admin/*" element={<OldAdminRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
