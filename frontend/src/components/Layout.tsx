import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, CreditCard, PieChart, Users, Settings, LogOut, Upload, Clock, Menu, X } from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadSlot } from "../hooks/useUploadSlot";
import GlobalFilterBar from "./GlobalFilterBar";
import api from "../api";

interface LayoutProps {
  children: React.ReactNode;
  user: { username: string; role: string } | null;
  onLogout: () => void;
  isAdmin: boolean;
}

const nav = [
  { to: "/facturacion", label: "Facturación", icon: BarChart3, metaKey: "facturas_ultima_actualizacion" },
  { to: "/cc", label: "Cuenta Corriente", icon: CreditCard, metaKey: "cc_movimientos_ultima_actualizacion" },
  { to: "/composicion", label: "Composición", icon: PieChart, metaKey: "composicion_ultima_actualizacion" },
  { to: "/clientes", label: "Clientes", icon: Users, metaKey: null },
];

function fmtMeta(meta: any): string | null {
  if (!meta?.timestamp) return null;
  const d = new Date(meta.timestamp);
  if (isNaN(d.getTime())) return null;
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (esHoy) return `Hoy ${hora}`;
  if (esAyer) return `Ayer ${hora}`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + ` ${hora}`;
}

export default function Layout({ children, user, onLogout, isAdmin }: LayoutProps) {
  const { config } = useUploadSlot();
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar al navegar en mobile
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const fetchMeta = useCallback(() => {
    api.get("/data/meta").then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchMeta(); }, []);

  // Recargar meta después de cada upload exitoso
  useEffect(() => {
    if (!config?.loading) fetchMeta();
  }, [config?.loading]);
  const onDrop = useCallback(
    (files: File[]) => { if (files[0] && config?.onFile) config.onFile(files[0]); },
    [config]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
    disabled: !config || config.loading,
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 lg:w-56 shrink-0 bg-ink flex flex-col text-white transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <img src="/logo_tiarg.png" alt="TIARG" className="w-full h-auto object-contain" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white/50 hover:text-white shrink-0 ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, metaKey }) => {
            const lastUpdate = metaKey ? fmtMeta(meta[metaKey]) : null;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-start gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                    isActive ? "bg-brand text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className="mt-0.5 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block">{label}</span>
                      {lastUpdate && (
                        <span className={clsx("flex items-center gap-1 text-[10px] font-normal mt-0.5", isActive ? "text-white/60" : "text-white/30 group-hover:text-white/50")}>
                          <Clock size={9} />
                          {lastUpdate}
                        </span>
                      )}
                      {!lastUpdate && metaKey && (
                        <span className={clsx("text-[10px] font-normal mt-0.5 block", isActive ? "text-white/40" : "text-white/20")}>
                          Sin datos
                        </span>
                      )}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
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

        {/* Zona de carga contextual */}
        {config && (
          <div className="px-3 pb-4 border-t border-white/10 pt-3">
            <p className="text-[10px] text-white/35 uppercase tracking-wide font-semibold mb-2">
              Cargar datos
            </p>
            <div
              {...getRootProps()}
              className={clsx(
                "border border-dashed rounded-xl p-3 text-center transition-colors cursor-pointer",
                isDragActive
                  ? "border-brand/80 bg-brand/10"
                  : "border-white/20 hover:border-brand/60 hover:bg-white/5",
                config.loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <input {...getInputProps()} />
              <Upload size={15} className="mx-auto mb-1 text-white/40" />
              <p className="text-xs font-medium text-white/65">
                {config.loading ? "Procesando..." : (isDragActive ? "Soltá aquí" : "Subir Excel")}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5 truncate">{config.label}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-surface flex flex-col min-w-0">
        {/* Top bar mobile */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-ink text-white shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu size={20} />
          </button>
          <img src="/logo_tiarg.png" alt="TIARG" className="h-7 w-auto object-contain" />
        </div>
        <GlobalFilterBar />
        <div className="flex-1 p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
