import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { useRegisterUploader } from "../hooks/useUploadSlot";
import { useGlobalFilters } from "../hooks/useGlobalFilters";

const fmt = (v: number) =>
  v === 0 ? "-" : `$ ${Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const fmtFecha = (s: string | null) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-AR");
};

export default function CuentasCorrientes() {
  const { ccModo, ccSeleccionados, dvModo, dvSeleccionados, clientesModo, clientesSeleccionados } = useGlobalFilters();
  const [clientes, setClientes] = useState<{ cliente: string; saldo: number }[]>([]);
  const [search, setSearch] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingMov, setLoadingMov] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchClientes = async () => {
    setLoadingClientes(true);
    try {
      const params: Record<string, string> = {};
      if (ccSeleccionados.length > 0)
        params[ccModo === "excluir" ? "cc_excluir" : "cc_incluir"] = ccSeleccionados.join(",");
      if (dvSeleccionados.length > 0)
        params[dvModo === "excluir" ? "dv_excluir" : "dv_incluir"] = dvSeleccionados.join(",");
      if (clientesSeleccionados.length > 0)
        params[clientesModo === "excluir" ? "cliente_excluir" : "cliente_incluir"] = clientesSeleccionados.join(",");
      const { data } = await api.get("/data/cc-movimientos-clientes", { params });
      setClientes(data);
    } catch {
      toast.error("Error al cargar clientes");
    } finally {
      setLoadingClientes(false);
    }
  };

  useEffect(() => { fetchClientes(); }, [ccModo, ccSeleccionados.join(","), dvModo, dvSeleccionados.join(","), clientesModo, clientesSeleccionados.join(",")]);

  const selectCliente = async (cliente: string) => {
    setSeleccionado(cliente);
    setLoadingMov(true);
    try {
      const { data } = await api.get("/data/cc-movimientos", { params: { cliente } });
      setMovimientos(data);
    } catch {
      toast.error("Error al cargar movimientos");
    } finally {
      setLoadingMov(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/etl/upload/cc", form);
      toast.success(`✓ ${data.filas} registros procesados`);
      setSeleccionado(null);
      setMovimientos([]);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  };

  useRegisterUploader(handleUpload, "cc_clientes.xlsx", uploading);

  const clientesFiltrados = clientes.filter((c) =>
    !search || c.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const saldoSeleccionado = clientes.find((c) => c.cliente === seleccionado)?.saldo ?? 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-8rem)]">
      {/* Panel izquierdo: lista de clientes */}
      <div className={`lg:w-72 shrink-0 bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${seleccionado ? "hidden lg:flex" : "flex"}`} style={{ maxHeight: seleccionado ? undefined : "50vh" }}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-ink">Cuenta Corriente</h1>
            {!loadingClientes && clientes.length > 0 && (
              <span className="text-[11px] font-medium text-muted bg-surface rounded-full px-2 py-0.5">
                {clientesFiltrados.length}{search ? `/${clientes.length}` : ""}
              </span>
            )}
          </div>
          <input
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingClientes ? (
            <div className="p-3 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3.5 bg-surface rounded w-3/4 mb-1.5" />
                  <div className="h-2.5 bg-surface rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-1">
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-xs font-medium text-ink">Sin datos de CC</p>
              <p className="text-[11px] text-muted">Subí el Excel de cuenta corriente usando el área de carga en el sidebar</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <p className="text-xs text-muted p-4">Sin resultados para &ldquo;{search}&rdquo;</p>
          ) : (
            clientesFiltrados.map((c) => (
              <button
                key={c.cliente}
                onClick={() => selectCliente(c.cliente)}
                className={`w-full text-left px-4 py-2.5 border-b border-surface transition-colors ${
                  seleccionado === c.cliente
                    ? "bg-brand/10 border-l-[3px] border-l-brand"
                    : "hover:bg-surface"
                }`}
              >
                <p className="text-sm font-medium text-ink truncate">{c.cliente}</p>
                <p className="text-xs text-muted mt-0.5">
                  Saldo: <span className={c.saldo > 0 ? "text-red-500 font-semibold" : "text-green-600"}>
                    $ {Math.abs(parseFloat(c.saldo)).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel derecho: movimientos */}
      <div className={`flex-1 bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${seleccionado ? "flex" : "hidden lg:flex"}`}>
        {!seleccionado ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
            <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center">
              <svg className="w-7 h-7 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink mb-1">Seleccioná un cliente</p>
              <p className="text-xs text-muted max-w-xs">Hacé clic en un nombre de la lista para ver todos sus movimientos y el saldo histórico</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              {/* Botón volver en mobile */}
              <button
                onClick={() => setSeleccionado(null)}
                className="lg:hidden text-muted hover:text-ink p-1 -ml-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="text-base font-bold text-ink">{seleccionado}</h2>
                <p className="text-xs text-muted mt-0.5">
                  Saldo neto:{" "}
                  <span className={saldoSeleccionado > 0 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                    $ {Math.abs(saldoSeleccionado).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    {saldoSeleccionado > 0 ? " (a favor empresa)" : " (a favor cliente)"}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingMov ? (
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-3 bg-surface rounded w-20" />
                      <div className="h-3 bg-surface rounded w-28" />
                      <div className="h-3 bg-surface rounded w-16" />
                      <div className="h-3 bg-surface rounded w-16 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : movimientos.length === 0 ? (
                <p className="text-xs text-muted p-5">Sin movimientos encontrados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface border-b border-border">
                    <tr className="text-left text-xs font-semibold text-muted">
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Comprobante</th>
                      <th className="hidden md:table-cell px-3 py-2.5">Documento</th>
                      <th className="hidden md:table-cell px-3 py-2.5">Vencimiento</th>
                      <th className="px-3 py-2.5 text-right">Debe</th>
                      <th className="px-3 py-2.5 text-right">Haber</th>
                      <th className="px-3 py-2.5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {movimientos.map((m, i) => (
                      <tr key={i} className="hover:bg-surface/60">
                        <td className="px-3 py-2 text-muted text-xs">{fmtFecha(m.fecha)}</td>
                        <td className="px-3 py-2 text-ink text-xs">{m.tipo || "-"}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-muted text-xs">{m.documento || "-"}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-muted text-xs">{fmtFecha(m.fecha_vencimiento)}</td>
                        <td className="px-3 py-2 text-right text-ink text-xs">{parseFloat(m.debe_ppal) > 0 ? fmt(parseFloat(m.debe_ppal)) : "-"}</td>
                        <td className="px-3 py-2 text-right text-green-600 text-xs">{parseFloat(m.haber_ppal) > 0 ? fmt(parseFloat(m.haber_ppal)) : "-"}</td>
                        <td className={`px-3 py-2 text-right font-medium text-xs ${parseFloat(m.saldo) > 0 ? "text-red-500" : "text-green-600"}`}>
                          {fmt(parseFloat(m.saldo || "0"))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
