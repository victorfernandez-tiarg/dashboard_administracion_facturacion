import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { useRegisterUploader } from "../hooks/useUploadSlot";
import { ChevronDown, ChevronRight, Users, X } from "lucide-react";
import { useGlobalFilters } from "../hooks/useGlobalFilters";

const fmt = (v: number) => `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const fmtFecha = (s: string | null) => {
  if (!s) return "-";
  // Parsear "YYYY-MM-DD" como hora local (no UTC) para evitar desfase de zona horaria
  const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const d = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-AR");
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-AR");
};

const AGING_COLORS: Record<string, string> = {
  "Al día": "#22c55e",
  "1–30 días": "#84cc16",
  "31–60 días": "#f59e0b",
  "61–90 días": "#f97316",
  "+90 días": "#ef4444",
};

function aging(dias: number) {
  if (dias <= 0) return "Al día";
  if (dias <= 30) return "1–30 días";
  if (dias <= 60) return "31–60 días";
  if (dias <= 90) return "61–90 días";
  return "+90 días";
}

export default function Composicion() {
  const { ccModo, ccSeleccionados, dvModo, dvSeleccionados, clientesModo, clientesSeleccionados } = useGlobalFilters();
  const [comp, setComp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (ccSeleccionados.length > 0)
        params[ccModo === "excluir" ? "cc_excluir" : "cc_incluir"] = ccSeleccionados.join(",");
      if (dvSeleccionados.length > 0)
        params[dvModo === "excluir" ? "dv_excluir" : "dv_incluir"] = dvSeleccionados.join(",");
      if (clientesSeleccionados.length > 0)
        params[clientesModo === "excluir" ? "cliente_excluir" : "cliente_incluir"] = clientesSeleccionados.join(",");
      const { data } = await api.get("/data/cc-composicion", { params });
      setComp(data);
    } catch {
      toast.error("Error al cargar composición");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [ccModo, ccSeleccionados.join(","), dvModo, dvSeleccionados.join(","), clientesModo, clientesSeleccionados.join(",")]);

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

  useRegisterUploader(handleUpload, "composicion_saldos.xlsx", uploading);

  // Agrupar comprobantes por cliente
  const porCliente = useMemo(() => {
    const map: Record<string, { cliente: string; saldo: number; maxDias: number; comprobantes: any[] }> = {};
    for (const c of comp) {
      if (!map[c.cliente]) map[c.cliente] = { cliente: c.cliente, saldo: 0, maxDias: 0, comprobantes: [] };
      const saldo = parseFloat(c.saldo_abierto || "0");
      map[c.cliente].saldo += saldo;
      map[c.cliente].maxDias = Math.max(map[c.cliente].maxDias, c.dias_vencido_item || 0);
      map[c.cliente].comprobantes.push(c);
    }
    return Object.values(map).sort((a, b) => b.saldo - a.saldo);
  }, [comp]);

  const filtrados = porCliente.filter((c) =>
    !search || c.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const deudaTotal = comp.reduce((s, c) => s + parseFloat(c.saldo_abierto || "0"), 0);
  const deudaSeleccionada = filtrados
    .filter((c) => seleccionados.has(c.cliente))
    .reduce((s, c) => s + c.saldo, 0);
  const totalTabla = filtrados.reduce((s, c) => s + c.saldo, 0);

  const toggleSeleccion = (cliente: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(cliente)) next.delete(cliente);
      else next.add(cliente);
      return next;
    });
  };

  const toggleExpandido = (cliente: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(cliente)) next.delete(cliente);
      else next.add(cliente);
      return next;
    });
  };

  const todosMarcados = filtrados.length > 0 && filtrados.every((c) => seleccionados.has(c.cliente));
  const toggleTodos = () => {
    if (todosMarcados) setSeleccionados(new Set());
    else setSeleccionados(new Set(filtrados.map((c) => c.cliente)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Composición de saldos</h1>
          <p className="text-sm text-muted mt-0.5">Deuda abierta por comprobante · Seleccioná varios clientes para ver el total combinado</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-border rounded-2xl p-4 animate-pulse">
                <div className="h-2.5 bg-surface rounded w-1/2 mb-3" />
                <div className="h-7 bg-surface rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-border rounded-2xl p-6 animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-surface rounded" />)}
          </div>
        </div>
      ) : comp.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center text-muted text-sm">
          Subí el archivo de composición de saldos para ver el detalle por comprobante.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Total deuda</p>
              <p className="text-2xl font-bold text-ink">{fmt(deudaTotal)}</p>
            </div>
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Clientes</p>
              <p className="text-2xl font-bold text-ink">{porCliente.length}</p>
            </div>
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Comprobantes</p>
              <p className="text-2xl font-bold text-ink">{comp.length}</p>
            </div>
            {seleccionados.size > 0 && (
              <div className="bg-brand/5 border border-brand/30 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Seleccionados ({seleccionados.size})</p>
                <p className="text-2xl font-bold text-brand">{fmt(deudaSeleccionada)}</p>
              </div>
            )}
          </div>

          {/* Tabla deudores */}
          <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide flex-1">Deudores</h2>
              <input
                className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-48"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {seleccionados.size > 0 && (
                <button onClick={() => setSeleccionados(new Set())} className="text-xs text-muted hover:text-brand">
                  Limpiar selección
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-left text-xs font-semibold text-muted">
                    <th className="px-4 py-2.5 w-8">
                      <input type="checkbox" checked={todosMarcados} onChange={toggleTodos} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                    </th>
                    <th className="px-4 py-2.5 w-6"></th>
                    <th className="px-4 py-2.5">Cliente</th>
                    <th className="px-4 py-2.5 text-right">Saldo total</th>
                    <th className="px-4 py-2.5 text-right">Comprobantes</th>
                    <th className="px-4 py-2.5">Aging máx.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {filtrados.map((c) => {
                    const expanded = expandidos.has(c.cliente);
                    const selected = seleccionados.has(c.cliente);
                    const ag = aging(c.maxDias);
                    return (
                      <>
                        <tr
                          key={c.cliente}
                          className={`transition-colors ${selected ? "bg-brand/5" : "hover:bg-surface/60"}`}
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSeleccion(c.cliente)}
                              className="accent-brand w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => toggleExpandido(c.cliente)} className="text-muted hover:text-brand">
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td
                            className="px-4 py-2.5 font-medium text-ink cursor-pointer hover:text-brand"
                            onClick={() => toggleExpandido(c.cliente)}
                          >
                            {c.cliente}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-ink">{fmt(c.saldo)}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{c.comprobantes.length}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: AGING_COLORS[ag] + "22", color: AGING_COLORS[ag] }}>
                              {ag}
                            </span>
                          </td>
                        </tr>

                        {/* Detalle comprobantes */}
                        {expanded && (
                          <tr key={`${c.cliente}-detail`}>
                            <td colSpan={6} className="bg-surface/40 px-0 py-0">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[10px] font-semibold text-muted border-b border-border">
                                    <th className="px-8 py-1.5">Documento</th>
                                    <th className="px-4 py-1.5">Centro de costo</th>
                                    <th className="px-4 py-1.5 text-right">Saldo abierto</th>
                                    <th className="px-4 py-1.5">Vencimiento</th>
                                    <th className="px-4 py-1.5 text-right">Días vencido</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {c.comprobantes
                                    .sort((a: any, b: any) => (b.dias_vencido_item || 0) - (a.dias_vencido_item || 0))
                                    .map((cp: any, i: number) => {
                                      const agCp = aging(cp.dias_vencido_item || 0);
                                      return (
                                        <tr key={i} className="hover:bg-white/60">
                                          <td className="px-8 py-1.5 text-ink">{cp.documento_ref || "-"}</td>
                                          <td className="px-4 py-1.5 text-muted">{cp.centro_costo || "-"}</td>
                                          <td className="px-4 py-1.5 text-right font-medium text-ink">{fmt(parseFloat(cp.saldo_abierto || "0"))}</td>
                                          <td className="px-4 py-1.5 text-muted">{fmtFecha(cp.venc_comp)}</td>
                                          <td className="px-4 py-1.5 text-right">
                                            <span className="font-medium" style={{ color: AGING_COLORS[agCp] }}>
                                              {cp.dias_vencido_item || 0}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  <tr className="border-t border-border/60 bg-white/40">
                                    <td colSpan={2} className="px-8 py-1.5 text-xs font-semibold text-muted">Subtotal</td>
                                    <td className="px-4 py-1.5 text-right text-xs font-bold text-ink">{fmt(c.saldo)}</td>
                                    <td colSpan={2} />
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                {/* Fila de totales */}
                <tfoot className="bg-surface border-t-2 border-border">
                  <tr className="text-xs font-bold text-ink">
                    <td colSpan={3} className="px-4 py-3">
                      Total{seleccionados.size > 0 ? ` (${seleccionados.size} seleccionados: ${fmt(deudaSeleccionada)})` : ` — ${filtrados.length} clientes`}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(totalTabla)}</td>
                    <td className="px-4 py-3 text-right text-muted font-normal">{filtrados.reduce((s, c) => s + c.comprobantes.length, 0)} comp.</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {/* Panel de deuda combinada para múltiples seleccionados */}
          {seleccionados.size > 0 && (() => {
            const clientesSelecArr = filtrados.filter((c) => seleccionados.has(c.cliente));
            const todosComprobantes = clientesSelecArr.flatMap((c) =>
              c.comprobantes.map((cp: any) => ({ ...cp, _cliente: c.cliente }))
            ).sort((a: any, b: any) => (b.dias_vencido_item || 0) - (a.dias_vencido_item || 0));

            // Resumen por aging
            const agingMap: Record<string, number> = {};
            for (const cp of todosComprobantes) {
              const ag = aging(cp.dias_vencido_item || 0);
              agingMap[ag] = (agingMap[ag] || 0) + parseFloat(cp.saldo_abierto || "0");
            }
            const agingOrden = ["Al día", "1–30 días", "31–60 días", "61–90 días", "+90 días"];

            return (
              <div className="bg-white border border-brand/30 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-brand/20 bg-brand/5 flex items-center gap-3">
                  <Users size={15} className="text-brand shrink-0" />
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-brand">
                      Deuda combinada · {seleccionados.size} {seleccionados.size === 1 ? "cliente" : "clientes"} seleccionados
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      {todosComprobantes.length} comprobantes pendientes · Total: <span className="font-semibold text-ink">{fmt(deudaSeleccionada)}</span>
                    </p>
                  </div>
                  <button onClick={() => setSeleccionados(new Set())} className="text-muted hover:text-brand transition-colors"><X size={15} /></button>
                </div>

                {/* Breakdown por aging */}
                <div className="px-5 py-3 border-b border-border flex flex-wrap gap-2">
                  {agingOrden.filter((ag) => agingMap[ag] > 0).map((ag) => (
                    <div key={ag} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: AGING_COLORS[ag] + "44", background: AGING_COLORS[ag] + "11" }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: AGING_COLORS[ag] }} />
                      <span className="font-medium" style={{ color: AGING_COLORS[ag] }}>{ag}</span>
                      <span className="text-muted">·</span>
                      <span className="font-semibold text-ink">{fmt(agingMap[ag])}</span>
                    </div>
                  ))}
                </div>

                {/* Tabla combinada */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface">
                      <tr className="text-left text-[10px] font-semibold text-muted border-b border-border">
                        <th className="px-5 py-2">Cliente</th>
                        <th className="px-4 py-2">Comprobante</th>
                        <th className="px-4 py-2">Centro de costo</th>
                        <th className="px-4 py-2 text-right">Importe</th>
                        <th className="px-4 py-2">Vencimiento</th>
                        <th className="px-4 py-2 text-right">Días venc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface">
                      {todosComprobantes.map((cp: any, i: number) => {
                        const agCp = aging(cp.dias_vencido_item || 0);
                        return (
                          <tr key={i} className="hover:bg-surface/40">
                            <td className="px-5 py-1.5 font-medium text-ink max-w-[150px] truncate">{cp._cliente}</td>
                            <td className="px-4 py-1.5 font-mono text-ink">{cp.documento_ref || "—"}</td>
                            <td className="px-4 py-1.5 text-muted">{cp.centro_costo || "—"}</td>
                            <td className="px-4 py-1.5 text-right font-semibold text-ink">{fmt(parseFloat(cp.saldo_abierto || "0"))}</td>
                            <td className="px-4 py-1.5 text-muted">{fmtFecha(cp.venc_comp)}</td>
                            <td className="px-4 py-1.5 text-right font-bold" style={{ color: AGING_COLORS[agCp] }}>
                              {cp.dias_vencido_item || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-brand/5 border-t-2 border-brand/20">
                      <tr>
                        <td colSpan={3} className="px-5 py-2.5 text-xs font-bold text-brand">
                          Total · {seleccionados.size} {seleccionados.size === 1 ? "cliente" : "clientes"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-brand">{fmt(deudaSeleccionada)}</td>
                        <td colSpan={2} className="px-4 py-2.5 text-right text-xs text-muted">{todosComprobantes.length} comp.</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
