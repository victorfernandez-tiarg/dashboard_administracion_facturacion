import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./hooks/useAuth";
import { UploadSlotProvider } from "./hooks/useUploadSlot";
import { GlobalFiltersProvider } from "./hooks/useGlobalFilters";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Facturacion from "./pages/Facturacion";
import CuentasCorrientes from "./pages/CuentasCorrientes";
import Composicion from "./pages/Composicion";
import Clientes from "./pages/Clientes";
import Admin from "./pages/Admin";
import Setup from "./pages/Setup";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, login, logout, isAdmin } = useAuth();

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <UploadSlotProvider>
              <GlobalFiltersProvider>
              <Layout user={user} onLogout={logout} isAdmin={isAdmin}>
                <Routes>
                  <Route path="/" element={<Navigate to="/facturacion" replace />} />
                  <Route path="/facturacion" element={<Facturacion />} />
                  <Route path="/cc" element={<CuentasCorrientes />} />
                  <Route path="/composicion" element={<Composicion />} />
                  <Route path="/clientes" element={<Clientes />} />
                  {isAdmin && <Route path="/admin" element={<Admin />} />}
                  <Route path="*" element={<Navigate to="/facturacion" replace />} />
                </Routes>
              </Layout>
              </GlobalFiltersProvider>
              </UploadSlotProvider>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
