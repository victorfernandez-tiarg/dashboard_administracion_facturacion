import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import toast from "react-hot-toast";
import api from "../api";
import FileDropzone from "../components/FileDropzone";

const fmt = (v: number) => `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const AGING_COLORS: Record<string, string> = {
  "Al día": "#22c55e",
  "1–30 días": "#84cc16",
  "31–60 días": "#f59e0b",
  "61–90 días": "#f97316",
  "+90 días": "#ef4444",
};

export default function Composicion() {
  const [comp, setComp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [groupByCentro, setGroupByCentro] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/data/cc-composicion");
      setComp(data);
    } catch {
      toast.error("Error al cargar composición");
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
      const { data } = await api.post("/etl/upload/composicion", form);
      toast.success(`✓ ${data.filas} comprobantes procesados`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  };

  const filtrados = comp.filter((c) =>
    !search || c.cliente?.toLowerCase().includes(search.toLowerCase()) || c.centro_costo?.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar por aging para chart
  const agingData = Object.entries(
    filtrados.reduce((acc: Record<string, number>, c) => {
      const bucket = c.dias_vencido_item <= 0 ? "Al día" : c.dias_vencido_item <= 30 ? "1–30 días" : c.dias_vencido_item <= 60 ? "31–60 días" : c.dias_vencido_item <= 90 ? "61–90 días" : "+90 días";
      acc[bucket] = (acc[bucket] || 0) + parseFloat(c.saldo_abierto || "0");
      return acc;
    }, {})
  ).map(([aging, total]) => ({ aging, total }));

  // Agrupar por centro si se pide
  const porcCentro = groupByCentro
    ? Object.entries(
        filtrados.reduce((acc: Record<string, number>, c) => {
          const k = c.centro_costo || "Sin centro";
          acc[k] = (acc[k] || 0) + parseFloat(c.saldo_abierto || "0");
          return acc;
        }, {})
      )
        .map(([centro, total]) => ({ centro, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Composición de saldos</h1>
        <div className="w-64">
          <FileDropzone onFile={handleUpload} label="composicion_saldos.xlsx" loading={uploading} />
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-sm animate-pulse">Cargando datos...</div>
      ) : comp.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center text-muted text-sm">
          Subí el archivo de composición de saldos para ver el detalle por comprobante.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {agingData.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Aging por comprobante</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={agingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="aging" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {agingData.map((entry) => (
                        <Cell key={entry.aging} fill={AGING_COLORS[entry.aging] || "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {groupByCentro && porcCentro.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Por centro de costo</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porcCentro} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis type="category" dataKey="centro" tick={{ fontSize: 9, fill: "#64748b" }} width={100} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Comprobantes pendientes</h2>
              <input
                className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-48"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={() => setGroupByCentro((v) => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${groupByCentro ? "bg-brand text-white border-brand" : "border-border text-muted"}`}
              >
                Por centro de costo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4">Centro</th>
                    <th className="pb-2 pr-4 text-right">Saldo abierto</th>
                    <th className="pb-2 pr-4">Vencimiento</th>
                    <th className="pb-2 text-right">Días vencido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {filtrados.slice(0, 200).map((c, i) => (
                    <tr key={i} className="hover:bg-surface/80">
                      <td className="py-2 pr-4 font-medium text-ink">{c.cliente}</td>
                      <td className="py-2 pr-4 text-muted text-xs">{c.centro_costo}</td>
                      <td className="py-2 pr-4 text-right">{fmt(parseFloat(c.saldo_abierto))}</td>
                      <td className="py-2 pr-4 text-muted text-xs">{c.venc_comp ? new Date(c.venc_comp).toLocaleDateString("es-AR") : "-"}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-medium ${c.dias_vencido_item > 90 ? "text-red-600" : c.dias_vencido_item > 30 ? "text-amber-600" : "text-green-600"}`}>
                          {c.dias_vencido_item || 0}
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
