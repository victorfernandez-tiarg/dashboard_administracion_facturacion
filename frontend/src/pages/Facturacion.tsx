import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
} from "recharts";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import FileDropzone from "../components/FileDropzone";
import { useRegisterUploader } from "../hooks/useUploadSlot";
import { useGlobalFilters } from "../hooks/useGlobalFilters";

const fmt = (v: number) =>
  `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtShort = (v: number) =>
  v >= 1e9
    ? `$${(v / 1e9).toFixed(2)}B`
    : v >= 1e6
    ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
    ? `$${(v / 1e3).toFixed(0)}K`
    : `$${Math.round(v)}`;
const fmtUSD = (v: number) =>
  `USD ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtUSDShort = (v: number) =>
  v >= 1e6
    ? `USD ${(v / 1e6).toFixed(2)}M`
    : `USD ${(v / 1e3).toFixed(0)}K`;

const monthLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${names[parseInt(m) - 1]} ${y.slice(2)}`;
};

// Paleta para centros de costo (hasta 12 colores distintos)
const CC_PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7",
];

const EMPRESA_COLORS: Record<string, string> = {
  "TIARG S.A.": "#6366f1",
  "TIARG LLC": "#10b981",
};
const DEFAULT_DESDE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();
const DEFAULT_HASTA = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

interface DetalleData {
  mes: string;
  empresa: string;
  resumen: {
    facturado_ars: string;
    facturado_usd: string;
    nc_ars: string;
    pendiente: string;
    clientes_activos: string;
    cantidad_facturas: string;
  };
  top_clientes: Array<{
    cliente: string; ars: string; usd: string;
    facturas: string; pendiente: string;
  }>;
  por_linea: Array<{ linea_negocio: string; ars: string; facturas: string }>;
}

interface ClienteData {
  cliente: string;
  resumen: Array<{
    empresa: string;
    razon_social: string;
    facturado_ars: string;
    facturado_usd: string;
    nc_ars: string;
    pendiente: string;
    cantidad_facturas: string;
  }>;
  mensual: Array<{
    mes: string;
    empresa: string;
    facturado_ars: string;
    facturado_usd: string;
    nc_ars: string;
    cantidad_facturas: string;
  }>;
  por_linea: Array<{ linea_negocio: string; ars: string; facturas: string }>;
  facturas: Array<{
    documento: string;
    numero: string;
    fecha: string;
    linea_negocio: string;
    condicion_pago: string;
    empresa: string;
    monto_total_ars: string;
    monto_usd: string;
    importe_pendiente: string;
    es_nota_credito: boolean;
    moneda_iso: string;
    dim_valor: string;
  }>;
}

export default function Facturacion() {
  const {
    filtroDesde, filtroHasta,
    ccModo, ccSeleccionados,
    dvModo, dvSeleccionados,
    buildParams, reloadOptions,
  } = useGlobalFilters();

  const [mensual, setMensual] = useState<any[]>([]);
  const [porCliente, setPorCliente] = useState<any[]>([]);
  const [mixCC, setMixCC] = useState<any[]>([]);
  const [mixCCLoading, setMixCCLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [detalle, setDetalle] = useState<DetalleData | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [barActiva, setBarActiva] = useState<{ mes: string; empresa: string } | null>(null);
  const [clienteActivo, setClienteActivo] = useState<string | null>(null);
  const [clienteData, setClienteData] = useState<ClienteData | null>(null);
  const [clienteLoading, setClienteLoading] = useState(false);
  const [panelTipo, setPanelTipo] = useState<"mes" | "cliente" | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [filtroDesde, filtroHasta, ccModo, ccSeleccionados.join(","), dvModo, dvSeleccionados.join(",")]);

  const fetchData = async () => {
    setLoading(true);
    setMixCCLoading(true);
    const params = buildParams();
    try {
      const [m, c, mx] = await Promise.all([
        api.get("/data/facturacion-mensual", { params }),
        api.get("/data/facturacion-por-cliente", { params }),
        api.get("/data/facturacion-mix-cc", { params }),
      ]);
      setMensual(m.data);
      setPorCliente(c.data);
      setMixCC(mx.data);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
      setMixCCLoading(false);
    }
  };

  // Centros de costo y dim valores se cargan en el contexto global

  const handleUpload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/etl/upload/facturacion", form);
      toast.success(`✓ ${data.filas} filas procesadas`);
      reloadOptions();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  };

  useRegisterUploader(handleUpload, "datos_facturacion.xlsx", uploading);

  const handleBarClick = async (chartData: any, empresa: string) => {
    if (!chartData?.activeLabel) return;
    const mes = chartData.activeLabel as string;
    setBarActiva({ mes, empresa });
    setDetalleLoading(true);
    setDetalle(null);
    setPanelTipo("mes");
    try {
      const params: Record<string, string> = { mes, empresa };
      if (ccSeleccionados.length > 0) {
        params[ccModo === "excluir" ? "cc_excluir" : "cc_incluir"] = ccSeleccionados.join(",");
      }
      if (dvSeleccionados.length > 0) {
        params[dvModo === "excluir" ? "dv_excluir" : "dv_incluir"] = dvSeleccionados.join(",");
      }
      if (clienteActivo) params.cliente = clienteActivo;
      const { data } = await api.get("/data/facturacion-detalle-mes", { params });
      setDetalle({ mes, empresa, ...data });
    } catch {
      toast.error("Error al cargar detalle");
    } finally {
      setDetalleLoading(false);
    }
  };

  const closePanel = () => setPanelTipo(null);

  const clearClienteActivo = () => {
    setClienteActivo(null);
    setClienteData(null);
    setClienteLoading(false);
    setPanelTipo(null);
    setBarActiva(null);
  };

  const handleClienteClick = async (cliente: string) => {
    if (clienteActivo === cliente && panelTipo === "cliente") {
      setPanelTipo(null);
      return;
    }
    setClienteActivo(cliente);
    setClienteData(null);
    setClienteLoading(true);
    setPanelTipo("cliente");
    setBarActiva(null);
    setDetalle(null);
    try {
      const params: Record<string, string> = { cliente };
      if (filtroDesde) params.fecha_desde = filtroDesde;
      if (filtroHasta) params.fecha_hasta = filtroHasta;
      if (ccSeleccionados.length > 0) {
        params[ccModo === "excluir" ? "cc_excluir" : "cc_incluir"] = ccSeleccionados.join(",");
      }
      if (dvSeleccionados.length > 0) {
        params[dvModo === "excluir" ? "dv_excluir" : "dv_incluir"] = dvSeleccionados.join(",");
      }
      const { data } = await api.get("/data/facturacion-cliente", { params });
      setClienteData({ cliente, ...data });
    } catch {
      toast.error("Error al cargar detalle de cliente");
    } finally {
      setClienteLoading(false);
    }
  };

  // Construir datos de gráficos por empresa
  const activeMensual = clienteActivo && clienteData ? clienteData.mensual : mensual;
  const empresas = ["TIARG S.A.", "TIARG LLC"];
  const meses = Array.from(new Set(mensual.map((r) => r.mes))).sort();

  // Normaliza empresa de BD a una de las dos empresas conocidas
  const normalizaEmpresa = (emp: string): string => {
    if (emp.toUpperCase().includes("LLC")) return "TIARG LLC";
    return "TIARG S.A.";
  };

  const chartDataForEmpresa = (empresa: string) =>
    meses.map((mes) => {
      // Agrupa todas las filas del mes cuya empresa normalizada coincida
      const rows = (activeMensual as any[]).filter(
        (r) => r.mes === mes && normalizaEmpresa(r.empresa) === empresa
      );
      return {
        mes,
        facturado_ars: rows.reduce((s, r) => s + parseFloat(r.facturado_ars || "0"), 0),
        facturado_usd: rows.reduce((s, r) => s + parseFloat(r.facturado_usd || "0"), 0),
        nc_ars: rows.reduce((s, r) => s + parseFloat(r.nc_ars || "0"), 0),
        cantidad_facturas: rows.reduce((s, r) => s + parseInt(r.cantidad_facturas || "0"), 0),
      };
    });

  const esInternacional = (empresa: string) =>
    empresa.toLowerCase().includes("llc");

  // ── Mix CC: pivotar para gráfico de barras apiladas 100% ──────────────────
  const allLineas = Array.from(new Set(mixCC.map((r) => r.linea_negocio))).sort(
    (a, b) => {
      // ordenar por total descendente
      const ta = mixCC.filter((r) => r.linea_negocio === a).reduce((s, r) => s + parseFloat(r.total_ars || "0"), 0);
      const tb = mixCC.filter((r) => r.linea_negocio === b).reduce((s, r) => s + parseFloat(r.total_ars || "0"), 0);
      return tb - ta;
    }
  );
  const ccColorMap: Record<string, string> = {};
  allLineas.forEach((l, i) => { ccColorMap[l] = CC_PALETTE[i % CC_PALETTE.length]; });

  const mixMeses = Array.from(new Set(mixCC.map((r) => r.mes))).sort();
  const mixChartData = mixMeses.map((mes) => {
    const mesRows = mixCC.filter((r) => r.mes === mes);
    const total = mesRows.reduce((s, r) => s + parseFloat(r.total_ars || "0"), 0);
    const entry: Record<string, any> = { mes, _total: total };
    allLineas.forEach((l) => {
      const row = mesRows.find((r) => r.linea_negocio === l);
      const v = row ? parseFloat(row.total_ars || "0") : 0;
      entry[l] = total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0;
      entry[`_abs_${l}`] = v;
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Facturación</h1>
          <p className="text-sm text-muted mt-0.5">Evolución de ventas · Clic en una barra para detalle del mes · Clic en un cliente para su ficha</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white border border-border rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-surface rounded w-1/4 mb-4" />
                <div className="h-40 bg-surface rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Badge cliente activo */}
          {clienteActivo && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-brand/8 text-brand border border-brand/25 rounded-xl px-3 py-1.5 text-xs font-semibold">
                <span>Viendo: {clienteActivo}</span>
                <button
                  onClick={clearClienteActivo}
                  className="text-brand/60 hover:text-brand transition-colors ml-1"
                >
                  <X size={12} />
                </button>
              </div>
              <span className="text-xs text-muted">Evolución mensual del cliente &middot; Clic en barra para detalle del mes</span>
            </div>
          )}

          {/* Gráficos por empresa */}
          {empresas.length > 0 && (
            <div className={`grid gap-4 ${empresas.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              {empresas.map((empresa) => {
                const chartData = chartDataForEmpresa(empresa);
                const isUSD = esInternacional(empresa);
                const color = EMPRESA_COLORS[empresa] ?? "#6366f1";
                const totalEmpresa = chartData.reduce(
                  (s, r) => s + (isUSD ? r.facturado_usd : r.facturado_ars),
                  0
                );
                return (
                  <div key={empresa} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h2 className="text-sm font-bold text-ink">{empresa}</h2>
                        <p className="text-xs text-muted mt-0.5">
                          Total período:{" "}
                          <span className="font-semibold text-ink">
                            {isUSD ? fmtUSDShort(totalEmpresa) : fmtShort(totalEmpresa)}
                          </span>
                        </p>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: color + "18", color }}
                      >
                        {isUSD ? "USD" : "ARS"}
                      </span>
                    </div>
                    <p className="text-xs text-muted/70 mb-3">Hacé clic en una barra para ver el detalle del mes</p>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={chartData}
                        onClick={(d) => handleBarClick(d, empresa)}
                        style={{ cursor: "pointer" }}
                        barCategoryGap="25%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="mes"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={monthLabel}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={(v) => (isUSD ? fmtUSDShort(v) : fmtShort(v))}
                          width={62}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: color + "12" }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
                                <p className="font-semibold text-ink mb-2">{monthLabel(label)}</p>
                                <div className="space-y-1">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted">Facturado</span>
                                    <span className="font-medium text-ink">
                                      {isUSD ? fmtUSD(d.facturado_usd) : fmt(d.facturado_ars)}
                                    </span>
                                  </div>
                                  {d.nc_ars > 0 && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-muted">Notas de crédito</span>
                                      <span className="font-medium text-amber-600">
                                        {fmt(d.nc_ars)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted">Facturas</span>
                                    <span className="font-medium text-ink">{d.cantidad_facturas}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey={isUSD ? "facturado_usd" : "facturado_ars"}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={44}
                        >
                          {chartData.map((entry) => {
                            const isActive =
                              barActiva?.mes === entry.mes && barActiva?.empresa === empresa;
                            return (
                              <Cell
                                key={entry.mes}
                                fill={color}
                                opacity={barActiva && !isActive ? 0.45 : 1}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}

          {/* Composición por Nivel 1 mes a mes */}
          {!mixCCLoading && mixChartData.length > 0 && allLineas.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-sm font-bold text-ink">Composición por Nivel 1</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Participación porcentual de cada Nivel 1 en el total facturado mensual (ARS)
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted/70 mb-3">
                Pasá el mouse sobre una sección para ver el monto exacto
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={mixChartData}
                  barCategoryGap="20%"
                  stackOffset="none"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={monthLabel}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    width={36}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = mixChartData.find((d) => d.mes === label)?._total ?? 0;
                      const items = payload
                        .filter((p) => (p.value as number) > 0)
                        .sort((a, b) => (b.value as number) - (a.value as number));
                      return (
                        <div className="bg-white border border-border rounded-xl shadow-xl p-3 text-xs max-w-[240px]">
                          <p className="font-semibold text-ink mb-2">
                            {monthLabel(label)} — {fmtShort(total)}
                          </p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {items.map((p) => {
                              const abs = mixChartData.find((d) => d.mes === label)?.[`_abs_${p.dataKey}`] ?? 0;
                              return (
                                <div key={p.dataKey as string} className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: p.fill as string }}
                                  />
                                  <span className="flex-1 text-ink truncate max-w-[130px]">{p.dataKey}</span>
                                  <span className="font-bold text-ink shrink-0">{(p.value as number).toFixed(1)}%</span>
                                  <span className="text-muted shrink-0">{fmtShort(abs)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {allLineas.map((linea) => (
                    <Bar
                      key={linea}
                      dataKey={linea}
                      stackId="cc"
                      fill={ccColorMap[linea]}
                      maxBarSize={52}
                      radius={
                        linea === allLineas[allLineas.length - 1]
                          ? [3, 3, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>

              {/* Leyenda manual */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-surface">
                {allLineas.map((linea) => {
                  const total = mixCC
                    .filter((r) => r.linea_negocio === linea)
                    .reduce((s, r) => s + parseFloat(r.total_ars || "0"), 0);
                  const grandTotal = mixCC.reduce((s, r) => s + parseFloat(r.total_ars || "0"), 0);
                  const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : "0";
                  return (
                    <div key={linea} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: ccColorMap[linea] }}
                      />
                      <span className="text-ink truncate max-w-[160px]">{linea}</span>
                      <span className="text-muted">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top clientes */}
          {porCliente.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Top clientes</h2>
                <p className="text-xs text-muted">Clic en un cliente para ver el detalle</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                      <th className="pb-2 pr-4">Cliente</th>
                      <th className="pb-2 pr-4">Empresa</th>
                      <th className="pb-2 pr-4 text-right">Total ARS</th>
                      <th className="pb-2 pr-4 text-right">Total USD</th>
                      <th className="pb-2 text-right">Facturas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {porCliente.slice(0, 20).map((c) => {
                      const isActive = clienteActivo === c.cliente;
                      return (
                        <tr
                          key={c.cliente}
                          onClick={() => handleClienteClick(c.cliente)}
                          className={`cursor-pointer transition-colors ${
                            isActive
                              ? "bg-brand/5"
                              : "hover:bg-surface/80"
                          }`}
                        >
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                              )}
                              <span className={`font-medium ${ isActive ? "text-brand" : "text-ink"}`}>
                                {c.cliente}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.razon_social === "Internacional"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {c.razon_social}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-muted">{fmt(parseFloat(c.total_ars))}</td>
                          <td className="py-2 pr-4 text-right text-muted">{fmtUSD(parseFloat(c.total_usd))}</td>
                          <td className="py-2 text-right text-muted">{c.cantidad_facturas}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Backdrop */}
      {panelTipo && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
      )}

      {/* Panel: detalle del mes */}
      {panelTipo === "mes" && (detalle || detalleLoading) && (
        <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl border-l border-border z-50 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide font-semibold">Detalle mensual</p>
                <h3 className="text-lg font-bold text-ink mt-0.5">
                  {detalle ? detalle.empresa : "Cargando..."}
                </h3>
                {detalle && <p className="text-sm text-muted">{monthLabel(detalle.mes)}</p>}
                {clienteActivo && <p className="text-xs text-brand font-medium mt-0.5">{clienteActivo}</p>}
              </div>
              <button onClick={closePanel} className="text-muted hover:text-ink transition-colors p-1 rounded-lg hover:bg-surface">
                <X size={18} />
              </button>
            </div>

            {detalleLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface rounded-xl" />)}
              </div>
            ) : detalle ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Facturado ARS", value: fmt(parseFloat(detalle.resumen.facturado_ars || "0")) },
                    { label: "Equivalente en USD", value: fmtUSD(parseFloat(detalle.resumen.facturado_usd || "0")) },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface rounded-xl p-3">
                      <p className="text-xs text-muted mb-1">{s.label}</p>
                      <p className="text-sm font-bold text-ink">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {detalle.por_linea.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Mix por Nivel 1</h4>
                    <div className="space-y-3">
                      {(() => {
                        const totalLinea = detalle.por_linea.reduce((s, l) => s + parseFloat(l.ars || "0"), 0);
                        return detalle.por_linea.map((l) => {
                          const pct = totalLinea > 0 ? (parseFloat(l.ars || "0") / totalLinea) * 100 : 0;
                          const color = EMPRESA_COLORS[detalle.empresa] ?? "#6366f1";
                          return (
                            <div key={l.linea_negocio}>
                              <div className="flex justify-between items-baseline text-xs mb-1">
                                <span className="font-medium text-ink truncate max-w-[180px]">{l.linea_negocio}</span>
                                <span className="text-muted ml-2 shrink-0">{fmtShort(parseFloat(l.ars || "0"))} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {detalle.top_clientes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Top clientes del mes</h4>
                    <div className="space-y-0.5">
                      {detalle.top_clientes.map((c, i) => {
                        const totalClientes = detalle.top_clientes.reduce((s, x) => s + parseFloat(x.ars || "0"), 0);
                        const pct = totalClientes > 0 ? (parseFloat(c.ars || "0") / totalClientes) * 100 : 0;
                        return (
                          <div key={c.cliente} className="flex items-center gap-3 py-2 border-b border-surface last:border-0">
                            <span className="text-xs text-muted/60 w-4 text-right font-mono">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-ink truncate">{c.cliente}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-ink">{fmtShort(parseFloat(c.ars || "0"))}</p>
                              <p className="text-xs text-muted/60">{pct.toFixed(0)}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Panel: detalle del cliente */}
      {panelTipo === "cliente" && (clienteData || clienteLoading) && (
        <div className="fixed inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl border-l border-border z-50 overflow-y-auto">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide font-semibold">Ficha de cliente</p>
                <h3 className="text-lg font-bold text-ink mt-0.5 leading-tight">
                  {clienteData?.cliente ?? "Cargando..."}
                </h3>
                {clienteData?.resumen[0] && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                    clienteData.resumen[0].razon_social === "Internacional"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-indigo-50 text-indigo-700"
                  }`}>
                    {clienteData.resumen[0].razon_social}
                  </span>
                )}
              </div>
              <button onClick={closePanel} className="text-muted hover:text-ink transition-colors p-1 rounded-lg hover:bg-surface">
                <X size={18} />
              </button>
            </div>

            {clienteLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1,2,3,4].map((i) => <div key={i} className="h-14 bg-surface rounded-xl" />)}
              </div>
            ) : clienteData ? (
              <div className="space-y-6">

                {/* KPIs por empresa */}
                {clienteData.resumen.map((emp) => {
                  const isUSD = emp.empresa.toLowerCase().includes("llc");
                  const color = EMPRESA_COLORS[emp.empresa] ?? "#6366f1";
                  const pendiente = parseFloat(emp.pendiente || "0");
                  const nc = parseFloat(emp.nc_ars || "0");
                  const facturado = parseFloat(emp.facturado_ars || "0");
                  const ncPct = facturado > 0 ? ((nc / facturado) * 100).toFixed(1) : null;
                  return (
                    <div key={emp.empresa}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-bold text-ink">{emp.empresa}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: color + "18", color }}>
                          {isUSD ? "USD" : "ARS"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface rounded-xl p-3">
                          <p className="text-xs text-muted mb-1">Facturado {isUSD ? "USD" : "ARS"}</p>
                          <p className="text-sm font-bold text-ink">
                            {isUSD ? fmtUSDShort(parseFloat(emp.facturado_usd || "0")) : fmtShort(facturado)}
                          </p>
                        </div>
                        <div className={`bg-surface rounded-xl p-3 ${nc > 0 ? "" : "opacity-40"}`}>
                          <p className="text-xs text-muted mb-1">Notas de crédito</p>
                          <p className="text-sm font-bold text-amber-600">
                            {fmtShort(nc)}
                            {ncPct && <span className="text-xs font-normal text-muted ml-1">{ncPct}%</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Evolución mensual mini-chart */}
                {clienteData.mensual.length > 0 && (() => {
                  const clienteEmpresas = Array.from(new Set(clienteData.mensual.map((r) => r.empresa))).sort();
                  const clienteMeses = Array.from(new Set(clienteData.mensual.map((r) => r.mes))).sort();
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Evolución mensual</h4>
                      {clienteEmpresas.map((emp) => {
                        const isUSD = emp.toLowerCase().includes("llc");
                        const color = EMPRESA_COLORS[emp] ?? "#6366f1";
                        const data = clienteMeses.map((mes) => {
                          const r = clienteData.mensual.find((x) => x.mes === mes && x.empresa === emp);
                          return {
                            mes,
                            v: r ? parseFloat(isUSD ? (r.facturado_usd || "0") : (r.facturado_ars || "0")) : 0,
                          };
                        });
                        const max = Math.max(...data.map((d) => d.v));
                        return (
                          <div key={emp} className="mb-3">
                            <p className="text-xs text-muted mb-1">{emp}</p>
                            <div className="flex items-end gap-0.5" style={{ height: 48 }}>
                              {data.map((d) => {
                                const barH = max > 0 ? Math.max(Math.round((d.v / max) * 40), d.v > 0 ? 2 : 0) : 0;
                                return (
                                  <div key={d.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 group relative">
                                    <div
                                      className="w-full rounded-t-sm transition-all duration-300"
                                      style={{ height: barH, backgroundColor: color, opacity: d.v > 0 ? 1 : 0.12 }}
                                    />
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                      {monthLabel(d.mes)}: {isUSD ? fmtUSDShort(d.v) : fmtShort(d.v)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-0.5 mt-0.5">
                              {data.map((d) => (
                                <div key={d.mes} className="flex-1 text-center">
                                  <span className="text-[8px] text-muted/60">{monthLabel(d.mes).split(" ")[0]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Mix Nivel 1 */}
                {clienteData.por_linea.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Mix por Nivel 1</h4>
                    <div className="space-y-2.5">
                      {(() => {
                        const total = clienteData.por_linea.reduce((s, l) => s + parseFloat(l.ars || "0"), 0);
                        return clienteData.por_linea.map((l) => {
                          const pct = total > 0 ? (parseFloat(l.ars || "0") / total) * 100 : 0;
                          return (
                            <div key={l.linea_negocio}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-ink truncate max-w-[200px]">{l.linea_negocio}</span>
                                <span className="text-muted ml-2 shrink-0">{fmtShort(parseFloat(l.ars || "0"))} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-brand/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Tabla de facturas */}
                {clienteData.facturas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                      Comprobantes ({clienteData.facturas.length})
                    </h4>
                    <div className="overflow-x-auto -mx-5 px-5">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left font-semibold text-muted border-b border-border">
                            <th className="pb-2 pr-3">Tipo</th>
                            <th className="pb-2 pr-3">Número</th>
                            <th className="pb-2 pr-3">Fecha</th>
                            <th className="pb-2 pr-3">Nivel 1</th>
                            <th className="pb-2 pr-3">Centro de costo</th>
                            <th className="pb-2 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface">
                          {clienteData.facturas.map((f, idx) => {
                            const isNC = f.es_nota_credito;
                            const isUSD = f.moneda_iso === "USD";
                            const importe = isUSD
                              ? fmtUSDShort(parseFloat(f.monto_usd || "0"))
                              : fmtShort(parseFloat(f.monto_total_ars || "0"));
                            const fechaFmt = (() => {
                              if (!f.fecha) return "-";
                              const p = f.fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
                              if (p) return new Date(parseInt(p[1]), parseInt(p[2]) - 1, parseInt(p[3])).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                              return new Date(f.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                            })();
                            return (
                              <tr key={idx} className={`${isNC ? "bg-amber-50/40" : ""}`}>
                                <td className="py-1.5 pr-3">
                                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                                    isNC ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"
                                  }`}>
                                    {isNC ? "NC" : "FC"}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-ink font-mono tabular-nums">{f.numero || f.documento || "—"}</td>
                                <td className="py-1.5 pr-3 text-muted tabular-nums">{fechaFmt}</td>
                                <td className="py-1.5 pr-3 text-ink max-w-[120px] truncate">{f.linea_negocio || "—"}</td>
                                <td className="py-1.5 pr-3 text-ink max-w-[120px] truncate">{f.dim_valor || "—"}</td>
                                <td className={`py-1.5 text-right font-medium ${isNC ? "text-amber-600" : "text-ink"}`}>
                                  {importe}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

