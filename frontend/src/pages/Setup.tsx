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
        <h1 className="text-xl font-bold text-ink mb-1">Configuración inicial</h1>
        <p className="text-muted text-sm mb-6">Crear el usuario administrador</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Usuario admin</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
            <input type="password" className="w-full border border-border rounded-lg px-3 py-2 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
          </div>
          <button type="submit" disabled={loading || password.length < 6} className="w-full bg-brand text-white font-semibold py-2 rounded-lg disabled:opacity-60">
            {loading ? "Creando..." : "Crear admin"}
          </button>
        </form>
      </div>
    </div>
  );
}
