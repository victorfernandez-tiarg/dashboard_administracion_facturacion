import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, CreditCard, PieChart, Users, Settings, LogOut, TrendingUp } from "lucide-react";
import clsx from "clsx";

interface LayoutProps {
  children: React.ReactNode;
  user: { username: string; role: string } | null;
  onLogout: () => void;
  isAdmin: boolean;
}

const nav = [
  { to: "/facturacion", label: "Facturación", icon: BarChart3 },
  { to: "/cc", label: "Cuenta Corriente", icon: CreditCard },
  { to: "/composicion", label: "Composición", icon: PieChart },
  { to: "/clientes", label: "Clientes", icon: Users },
];

export default function Layout({ children, user, onLogout, isAdmin }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-ink flex flex-col text-white">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-brand" />
            <span className="font-bold text-lg tracking-tight">Finnegans BI</span>
          </div>
          <p className="text-xs text-white/40 mt-1">tiarg</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-brand text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-brand text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Settings size={16} />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 truncate mb-2">👤 {user?.username}</p>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors w-full"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-surface p-6">
        {children}
      </main>
    </div>
  );
}
