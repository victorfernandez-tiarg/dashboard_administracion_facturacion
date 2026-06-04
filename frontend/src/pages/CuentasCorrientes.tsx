import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, Clock, CheckCircle, TrendingDown } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import KpiCard from "../components/KpiCard";
import FileDropzone from "../components/FileDropzone";

const fmt = (v: number) => `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const AGING_COLORS: Record<string, string> = {
  "Al día": "#22c55e",
  "1–30 días": "#84cc16",
  "31–60 días": "#f59e0b",
  "61–90 días": "#f97316",
  "+90 días": "#ef4444",
};

export default function CuentasCorrientes() {
  const [saldos, setSaldos] = useState<any[]>([]);
  const [agingSummary, setAgingSummary] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, a, k] = await Promise.all([
        api.get("/data/cc-saldos"),
        api.get("/data/aging-summary"),
        api.get("/data/kpis"),
      ]);
      setSaldos(s.data);
      setAgingSummary(a.data);
      setKpis(k.data);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/etl/upload/cc", form);
      toast.success(`✓ ${data.filas} registros procesados`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  };

  const filtrados = saldos.filter((s) =>
    !search || s.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const deudaTotal = saldos.reduce((sum, s) => sum + parseFloat(s.saldo_actual || "0"), 0);
  const deudaVencida = saldos.reduce((sum, s) => sum + parseFloat(s.saldo_vencido || "0"), 0);
  const clientesConDeuda = saldos.filter((s) => parseFloat(s.saldo_actual) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Cuenta Corriente</h1>
        <div className="w-64">
          <FileDropzone onFile={handleUpload} label="cc_clientes.xlsx" loading={uploading} />
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm animate-pulse">Cargando datos...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Deuda total" value={fmt(deudaTotal)} icon={<TrendingDown size={16} />} />
            <KpiCard label="Deuda vencida" value={fmt(deudaVencida)} color="red" icon={<AlertTriangle size={16} />} />
            <KpiCard label="Clientes con deuda" value={String(clientesConDeuda)} icon={<Clock size={16} />} />
            <KpiCard label="DSO (días)" value={String(kpis?.dso ?? "-")} sub="días de ventas pendientes" color={kpis?.dso > 60 ? "red" : "default"} icon={<CheckCircle size={16} />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aging donut */}
            {agingSummary.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Aging de deuda</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={agingSummary} dataKey="total" nameKey="aging" cx="50%" cy="50%" outerRadius={90} label={({ aging, percent }) => `${aging} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {agingSummary.map((entry) => (
                        <Cell key={entry.aging} fill={AGING_COLORS[entry.aging] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Aging bar */}
            {agingSummary.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Deuda por bucket</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={agingSummary} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis type="category" dataKey="aging" tick={{ fontSize: 11, fill: "#64748b" }} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {agingSummary.map((entry) => (
                        <Cell key={entry.aging} fill={AGING_COLORS[entry.aging] || "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabla saldos */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Deudores</h2>
              <input
                className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-48"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4 text-right">Saldo actual</th>
                    <th className="pb-2 pr-4 text-right">Saldo vencido</th>
                    <th className="pb-2 pr-4 text-right">Días vencido</th>
                    <th className="pb-2">Aging</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {filtrados.slice(0, 100).map((s, i) => (
                    <tr key={i} className="hover:bg-surface/80">
                      <td className="py-2 pr-4 font-medium text-ink">{s.cliente}</td>
                      <td className="py-2 pr-4 text-right">{fmt(parseFloat(s.saldo_actual))}</td>
                      <td className="py-2 pr-4 text-right text-red-600">{parseFloat(s.saldo_vencido) > 0 ? fmt(parseFloat(s.saldo_vencido)) : "-"}</td>
                      <td className="py-2 pr-4 text-right text-muted">{s.dias_vencido || 0}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: AGING_COLORS[s.aging] + "22", color: AGING_COLORS[s.aging] }}>
                          {s.aging}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
