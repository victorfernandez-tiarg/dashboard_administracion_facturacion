import { useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2, Key } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";

export default function Admin() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [changingPwd, setChangingPwd] = useState<number | null>(null);
  const [newPwd, setNewPwd] = useState("");

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
                <th className="pb-2 pr-4">Creado</th>
                <th className="pb-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-4 font-medium">{u.username}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-brand/10 text-brand" : "bg-surface text-muted"}`}>{u.role}</span>
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
                          <button onClick={() => { setChangingPwd(u.id); setNewPwd(""); }} className="text-muted hover:text-brand transition-colors"><Key size={14} /></button>
                          <button onClick={() => handleDelete(u.id, u.username)} className="text-muted hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
