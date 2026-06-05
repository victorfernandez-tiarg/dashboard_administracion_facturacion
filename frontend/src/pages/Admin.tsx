import { useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2, Key, Shield, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";

interface Restricciones { cc: string[]; dv: string[]; clientes: string[] }

export default function Admin() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [changingPwd, setChangingPwd] = useState<number | null>(null);
  const [newPwd, setNewPwd] = useState("");

  // Restricciones
  const [editingRestr, setEditingRestr] = useState<number | null>(null);
  const [restr, setRestr] = useState<Restricciones>({ cc: [], dv: [], clientes: [] });
  const [opcionesCc, setOpcionesCc] = useState<string[]>([]);
  const [opcionesDv, setOpcionesDv] = useState<string[]>([]);
  const [opcionesClientes, setOpcionesClientes] = useState<string[]>([]);
  const [savingRestr, setSavingRestr] = useState(false);

  const fetchUsuarios = async () => {
    try {
      const { data } = await api.get("/admin/usuarios");
      setUsuarios(data);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleSyncDrive = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/etl/sync-drive");
      toast.success(`Sincronizados: ${data.archivos.join(", ") || "ninguno"}`);
      if (data.errores.length) toast.error(`Errores: ${data.errores.join(", ")}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/usuarios", newUser);
      toast.success("Usuario creado");
      setNewUser({ username: "", password: "", role: "user" });
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al crear usuario");
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return;
    await api.delete(`/admin/usuarios/${id}`);
    toast.success("Usuario eliminado");
    fetchUsuarios();
  };

  const handleChangePwd = async (id: number) => {
    if (!newPwd) return;
    await api.put(`/admin/usuarios/${id}/password`, { password: newPwd });
    toast.success("Contraseña actualizada");
    setChangingPwd(null);
    setNewPwd("");
  };

  const openRestr = async (u: any) => {
    setEditingRestr(u.id);
    setRestr(u.restricciones || { cc: [], dv: [], clientes: [] });
    try {
      const [rCc, rDv, rCl] = await Promise.all([
        api.get("/data/centros-costo"),
        api.get("/data/dim-valores"),
        api.get("/data/clientes"),
      ]);
      setOpcionesCc(rCc.data);
      setOpcionesDv(rDv.data);
      setOpcionesClientes(rCl.data);
    } catch {
      toast.error("Error al cargar opciones");
    }
  };

  const saveRestr = async () => {
    if (editingRestr === null) return;
    setSavingRestr(true);
    try {
      await api.put(`/admin/usuarios/${editingRestr}/restricciones`, { restricciones: restr });
      setUsuarios((prev) => prev.map((u) => u.id === editingRestr ? { ...u, restricciones: restr } : u));
      toast.success("Permisos guardados");
      setEditingRestr(null);
    } catch {
      toast.error("Error al guardar permisos");
    } finally {
      setSavingRestr(false);
    }
  };

  const toggleRestrItem = (field: keyof Restricciones, val: string) => {
    setRestr((prev) => ({
      ...prev,
      [field]: prev[field].includes(val) ? prev[field].filter((x) => x !== val) : [...prev[field], val],
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Administración</h1>

      {/* Sync Drive */}
      <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Google Drive</h2>
        <p className="text-sm text-muted mb-4">Sincroniza los archivos Excel desde Google Drive y reprocesa los datos.</p>
        <button
          onClick={handleSyncDrive}
          disabled={syncing}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 hover:bg-brand-dark transition-colors"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </div>

      {/* Usuarios */}
      <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Usuarios</h2>

        {/* Crear */}
        <form onSubmit={handleCreateUser} className="flex gap-2 mb-6 flex-wrap">
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-40"
            placeholder="Usuario"
            value={newUser.username}
            onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))}
          />
          <input
            type="password"
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-40"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
          />
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
            value={newUser.role}
            onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
          >
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="flex items-center gap-1.5 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
            <Plus size={14} /> Crear
          </button>
        </form>

        {/* Lista */}
        {loading ? (
          <div className="text-muted text-sm animate-pulse">Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                <th className="pb-2 pr-4">Usuario</th>
                <th className="pb-2 pr-4">Rol</th>
                <th className="pb-2 pr-4">Acceso</th>
                <th className="pb-2 pr-4">Creado</th>
                <th className="pb-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {usuarios.map((u) => {
                const r: Restricciones = u.restricciones || { cc: [], dv: [], clientes: [] };
                const sinRestr = r.cc.length === 0 && r.dv.length === 0 && r.clientes.length === 0;
                return (
                <tr key={u.id}>
                  <td className="py-2 pr-4 font-medium">{u.username}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-brand/10 text-brand" : "bg-surface text-muted"}`}>{u.role}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {sinRestr ? (
                      <span className="text-xs text-green-600 font-medium">Todo</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.cc.map((v) => <span key={v} className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded">N1: {v}</span>)}
                        {r.dv.map((v) => <span key={v} className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">CC: {v}</span>)}
                        {r.clientes.slice(0, 3).map((v) => <span key={v} className="text-[10px] bg-surface text-muted px-1.5 py-0.5 rounded border border-border truncate max-w-[100px]">{v}</span>)}
                        {r.clientes.length > 3 && <span className="text-[10px] text-muted">+{r.clientes.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-muted text-xs">{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                  <td className="py-2">
                    <div className="flex gap-2 items-center">
                      {changingPwd === u.id ? (
                        <>
                          <input type="password" className="border border-border rounded px-2 py-1 text-xs w-32" placeholder="Nueva contraseña" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                          <button onClick={() => handleChangePwd(u.id)} className="text-xs bg-brand text-white px-2 py-1 rounded">OK</button>
                          <button onClick={() => setChangingPwd(null)} className="text-xs text-muted">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openRestr(u)} title="Editar permisos" className="text-muted hover:text-brand transition-colors"><Shield size={14} /></button>
                          <button onClick={() => { setChangingPwd(u.id); setNewPwd(""); }} className="text-muted hover:text-brand transition-colors"><Key size={14} /></button>
                          <button onClick={() => handleDelete(u.id, u.username)} className="text-muted hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal edición de restricciones */}
      {editingRestr !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-ink">Permisos de acceso</h2>
                <p className="text-xs text-muted mt-0.5">Dejá vacío para dar acceso total. Seleccioná valores para restringir a solo esos.</p>
              </div>
              <button onClick={() => setEditingRestr(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Nivel 1 */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Nivel 1 permitidos {restr.cc.length > 0 && <span className="normal-case text-brand">({restr.cc.length} seleccionados)</span>}
                </label>
                {opcionesCc.length === 0 ? <p className="text-xs text-muted">Sin datos cargados</p> : (
                  <div className="flex flex-wrap gap-2">
                    {opcionesCc.map((v) => (
                      <button key={v} type="button" onClick={() => toggleRestrItem("cc", v)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${restr.cc.includes(v) ? "bg-brand text-white border-brand" : "border-border text-ink hover:border-brand/50"}`}
                      >{v}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Centro de costo */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Centro de costo permitidos {restr.dv.length > 0 && <span className="normal-case text-brand">({restr.dv.length} seleccionados)</span>}
                </label>
                {opcionesDv.length === 0 ? <p className="text-xs text-muted">Sin datos cargados</p> : (
                  <div className="flex flex-wrap gap-2">
                    {opcionesDv.map((v) => (
                      <button key={v} type="button" onClick={() => toggleRestrItem("dv", v)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${restr.dv.includes(v) ? "bg-purple-600 text-white border-purple-600" : "border-border text-ink hover:border-purple-300"}`}
                      >{v}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Clientes */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Clientes permitidos {restr.clientes.length > 0 && <span className="normal-case text-brand">({restr.clientes.length} seleccionados)</span>}
                </label>
                {opcionesClientes.length === 0 ? <p className="text-xs text-muted">Sin datos cargados</p> : (
                  <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto border border-surface rounded-xl p-2">
                    {opcionesClientes.map((v) => (
                      <label key={v} className="flex items-center gap-2 px-2 py-1 hover:bg-surface rounded cursor-pointer select-none">
                        <input type="checkbox" checked={restr.clientes.includes(v)} onChange={() => toggleRestrItem("clientes", v)} className="accent-brand w-3.5 h-3.5" />
                        <span className="text-xs text-ink truncate">{v}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
              <button type="button" onClick={() => setRestr({ cc: [], dv: [], clientes: [] })} className="text-xs text-muted hover:text-brand border border-border px-3 py-1.5 rounded-lg">
                Limpiar todo (acceso total)
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingRestr(null)} className="text-xs text-muted border border-border px-4 py-1.5 rounded-lg hover:border-brand/30">Cancelar</button>
                <button type="button" onClick={saveRestr} disabled={savingRestr}
                  className="flex items-center gap-1.5 text-xs bg-brand text-white px-4 py-1.5 rounded-lg font-semibold disabled:opacity-60 hover:bg-brand/90">
                  <Check size={13} /> {savingRestr ? "Guardando..." : "Guardar permisos"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
