import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { DollarSign, TrendingUp, Users, FileText } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import KpiCard from "../components/KpiCard";
import FileDropzone from "../components/FileDropzone";

const fmt = (v: number) => `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtUSD = (v: number) => `USD ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function Facturacion() {
  const [kpis, setKpis] = useState<any>(null);
  const [mensual, setMensual] = useState<any[]>([]);
  const [porCliente, setPorCliente] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filtroRazon, setFiltroRazon] = useState<"Todos" | "Local" | "Internacional">("Todos");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [k, m, c] = await Promise.all([
        api.get("/data/kpis"),
        api.get("/data/facturacion-mensual"),
        api.get("/data/facturacion-por-cliente"),
      ]);
      setKpis(k.data);
      setMensual(m.data);
      setPorCliente(c.data);
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
      const { data } = await api.post("/etl/upload/facturacion", form);
      toast.success(`✓ ${data.filas} filas procesadas`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  };

  // Agrupar mensual por mes sumando ARS
  const mensualARS = mensual
    .filter((r) => r.moneda_iso === "ARS")
    .reduce((acc: Record<string, number>, r) => {
      acc[r.mes] = (acc[r.mes] || 0) + parseFloat(r.total);
      return acc;
    }, {});
  const mensualData = Object.entries(mensualARS).map(([mes, total]) => ({ mes, total })).slice(-12);

  const clientesFiltrados = porCliente
    .filter((c) => filtroRazon === "Todos" || c.razon_social === filtroRazon)
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Facturación</h1>
        <div className="w-64">
          <FileDropzone onFile={handleUpload} label="datos_facturacion.xlsx" loading={uploading} />
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm animate-pulse">Cargando datos...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Facturado 90d (ARS)" value={kpis ? fmt(kpis.total_facturado) : "-"} icon={<DollarSign size={16} />} />
            <KpiCard label="Facturado 90d (USD)" value={kpis ? fmtUSD(kpis.total_usd) : "-"} icon={<TrendingUp size={16} />} />
            <KpiCard label="Clientes activos" value={kpis?.total_clientes ?? "-"} icon={<Users size={16} />} />
            <KpiCard label="Notas de crédito" value={kpis ? fmt(kpis.total_nc) : "-"} color="amber" icon={<FileText size={16} />} />
          </div>

          {/* Gráfico mensual */}
          {mensualData.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Facturación mensual (ARS)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mensualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla por cliente */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Top clientes</h2>
              <div className="flex gap-2">
                {(["Todos", "Local", "Internacional"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setFiltroRazon(r)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      filtroRazon === r ? "bg-brand text-white border-brand" : "border-border text-muted hover:border-brand/50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4 text-right">Total ARS</th>
                    <th className="pb-2 pr-4 text-right">Total USD</th>
                    <th className="pb-2 text-right">Facturas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {clientesFiltrados.map((c) => (
                    <tr key={c.cliente} className="hover:bg-surface/80">
                      <td className="py-2 pr-4 font-medium text-ink">{c.cliente}</td>
                      <td className="py-2 pr-4 text-right text-muted">{fmt(parseFloat(c.total_ars))}</td>
                      <td className="py-2 pr-4 text-right text-muted">{fmtUSD(parseFloat(c.total_usd))}</td>
                      <td className="py-2 text-right text-muted">{c.cantidad_facturas}</td>
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
