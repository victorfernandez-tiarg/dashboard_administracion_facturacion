import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";

export default function Setup() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/setup", { username, password });
      toast.success("Admin creado. Ya podés ingresar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al crear admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-ink mb-1">Configuración inicial</h1>
          <p className="text-muted text-sm">Este paso se hace <strong>una sola vez</strong>. Creá el usuario administrador para comenzar a usar el sistema.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Nombre de usuario</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
            <input
              type="password"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
            />
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-amber-500 mt-1">La contraseña debe tener al menos 8 caracteres</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !username || password.length < 8}
            className="w-full bg-brand text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-opacity hover:bg-brand/90"
          >
            {loading ? "Creando..." : "Crear administrador"}
          </button>
        </form>
      </div>
    </div>
  );
}
