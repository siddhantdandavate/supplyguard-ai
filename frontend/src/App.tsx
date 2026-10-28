import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth, RedirectIfAuthed } from './components/layout/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DisruptionsPage } from './pages/DisruptionsPage';
import { DisruptionDetailPage } from './pages/DisruptionDetailPage';
import { WarRoomPage } from './pages/WarRoomPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SupplierWorkspacePage } from './pages/SupplierWorkspacePage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const App: React.FC = () => (
  <Routes>
    <Route
      path="/login"
      element={
        <RedirectIfAuthed>
          <LoginPage />
        </RedirectIfAuthed>
      }
    />
    <Route
      path="/register"
      element={
        <RedirectIfAuthed>
          <RegisterPage />
        </RedirectIfAuthed>
      }
    />
    <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/disruptions" element={<DisruptionsPage />} />
        <Route path="/disruptions/:id" element={<DisruptionDetailPage />} />
        <Route path="/war-room" element={<WarRoomPage />} />
        <Route path="/war-room/:id" element={<WarRoomPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:id" element={<SuppliersPage />} />
        <Route path="/supplier" element={<SupplierWorkspacePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);

export default App;
