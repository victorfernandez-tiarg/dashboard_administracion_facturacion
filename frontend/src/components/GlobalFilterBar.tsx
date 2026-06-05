import { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useGlobalFilters, DEFAULT_DESDE, DEFAULT_HASTA } from "../hooks/useGlobalFilters";

export default function GlobalFilterBar() {
  const {
    filtroDesde, filtroHasta, setFiltroDesde, setFiltroHasta,
    ccModo, setCcModo, ccSeleccionados, setCcSeleccionados, centrosCosto,
    dvModo, setDvModo, dvSeleccionados, setDvSeleccionados, dimValores,
    clientesModo, setClientesModo, clientesSeleccionados, setClientesSeleccionados, clientes,
    hasFilters, resetFilters, reloadOptions,
  } = useGlobalFilters();

  const [ccOpen, setCcOpen] = useState(false);
  const [dvOpen, setDvOpen] = useState(false);
  const [clOpen, setClOpen] = useState(false);
  const [clSearch, setClSearch] = useState("");
  const ccRef = useRef<HTMLDivElement>(null);
  const dvRef = useRef<HTMLDivElement>(null);
  const clRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ccRef.current && !ccRef.current.contains(e.target as Node)) setCcOpen(false);
      if (dvRef.current && !dvRef.current.contains(e.target as Node)) setDvOpen(false);
      if (clRef.current && !clRef.current.contains(e.target as Node)) setClOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const ccLabel = (() => {
    if (ccSeleccionados.length === 0) return "Todos los niveles";
    if (ccSeleccionados.length === 1) return `${ccModo === "excluir" ? "Excluir" : "Solo"}: ${ccSeleccionados[0]}`;
    return `${ccModo === "excluir" ? "Excluir" : "Solo"} ${ccSeleccionados.length}`;
  })();

  const dvLabel = (() => {
    if (dvSeleccionados.length === 0) return "Todos los centros";
    if (dvSeleccionados.length === 1) return `${dvModo === "excluir" ? "Excluir" : "Solo"}: ${dvSeleccionados[0]}`;
    return `${dvModo === "excluir" ? "Excluir" : "Solo"} ${dvSeleccionados.length}`;
  })();

  const toggleCC = (v: string) =>
    setCcSeleccionados((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  const ccTodos = ccSeleccionados.length === centrosCosto.length && centrosCosto.length > 0;
  const toggleTodosCC = () => setCcSeleccionados(ccTodos ? [] : [...centrosCosto]);

  const toggleDV = (v: string) =>
    setDvSeleccionados((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  const dvTodos = dvSeleccionados.length === dimValores.length && dimValores.length > 0;
  const toggleTodosDV = () => setDvSeleccionados(dvTodos ? [] : [...dimValores]);

  const clLabel = (() => {
    if (clientesSeleccionados.length === 0) return "Todos los clientes";
    if (clientesSeleccionados.length === 1) return `${clientesModo === "excluir" ? "Excluir" : "Solo"}: ${clientesSeleccionados[0]}`;
    return `${clientesModo === "excluir" ? "Excluir" : "Solo"} ${clientesSeleccionados.length} clientes`;
  })();
  const clientesFiltrados = clientes.filter((c) => !clSearch || c.toLowerCase().includes(clSearch.toLowerCase()));
  const clTodos = clientesSeleccionados.length === clientes.length && clientes.length > 0;
  const toggleCl = (v: string) =>
    setClientesSeleccionados((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  const toggleTodosCl = () => setClientesSeleccionados(clTodos ? [] : [...clientes]);

  return (
    <div className="border-b border-border bg-white px-4 lg:px-6 py-2.5 shrink-0">
      <div className="flex gap-3 items-end overflow-x-auto lg:overflow-visible pb-0.5 scrollbar-none">
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Desde</label>
          <input
            type="month"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className="border border-border rounded-lg px-2.5 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        {/* Hasta */}
        <div className="shrink-0">
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Hasta</label>
          <input
            type="month"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className="border border-border rounded-lg px-2.5 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Nivel 1 */}
        <div className="relative shrink-0" ref={ccRef}>
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Nivel 1</label>
          <button
            type="button"
            onClick={() => { const next = !ccOpen; setCcOpen(next); if (next) reloadOptions(); }}
            className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors min-w-[180px] ${
              ccSeleccionados.length > 0 ? "border-brand text-brand font-medium" : "border-border text-ink"
            }`}
          >
            <span className="flex-1 text-left truncate">{ccLabel}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform ${ccOpen ? "rotate-180" : ""}`} />
          </button>
          {ccOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-xl w-72">
              <div className="flex border-b border-border">
                {(["excluir", "incluir"] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setCcModo(m); setCcSeleccionados([]); }}
                    className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${ccModo === m ? "bg-brand text-white" : "text-muted hover:bg-surface"} ${m === "excluir" ? "rounded-tl-xl" : "rounded-tr-xl"}`}
                  >
                    {m === "excluir" ? "Ocultar seleccionados" : "Mostrar solo estos"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface">
                <input type="checkbox" id="gf-cc-todos" checked={ccTodos} onChange={toggleTodosCC} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                <label htmlFor="gf-cc-todos" className="text-xs text-ink font-medium cursor-pointer select-none">
                  {ccTodos ? "Quitar todos" : "Seleccionar todos"}
                </label>
                {ccSeleccionados.length > 0 && (
                  <button type="button" onClick={() => setCcSeleccionados([])} className="ml-auto text-xs text-muted hover:text-brand">Limpiar</button>
                )}
              </div>
              <div className="overflow-y-auto max-h-48 py-1">
                {centrosCosto.length === 0 ? (
                  <p className="text-xs text-muted px-3 py-2">Sin datos — subí el Excel de facturación</p>
                ) : centrosCosto.map((cc) => (
                  <label key={cc} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface cursor-pointer select-none">
                    <input type="checkbox" checked={ccSeleccionados.includes(cc)} onChange={() => toggleCC(cc)} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                    <span className="text-xs text-ink truncate">{cc}</span>
                  </label>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-surface">
                <button type="button" onClick={() => setCcOpen(false)} className="w-full text-xs bg-brand text-white py-1.5 rounded-lg font-semibold hover:bg-brand/90 transition-colors">Aplicar</button>
              </div>
            </div>
          )}
        </div>

        {/* Centro de costo (dim_valor) */}
        <div className="relative shrink-0" ref={dvRef}>
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Centro de costo</label>
          <button
            type="button"
            onClick={() => { const next = !dvOpen; setDvOpen(next); if (next) reloadOptions(); }}
            className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors min-w-[180px] ${
              dvSeleccionados.length > 0 ? "border-brand text-brand font-medium" : "border-border text-ink"
            }`}
          >
            <span className="flex-1 text-left truncate">{dvLabel}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform ${dvOpen ? "rotate-180" : ""}`} />
          </button>
          {dvOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-xl w-68">
              <div className="flex border-b border-border">
                {(["excluir", "incluir"] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setDvModo(m); setDvSeleccionados([]); }}
                    className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${dvModo === m ? "bg-brand text-white" : "text-muted hover:bg-surface"} ${m === "excluir" ? "rounded-tl-xl" : "rounded-tr-xl"}`}
                  >
                    {m === "excluir" ? "Ocultar seleccionados" : "Mostrar solo estos"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface">
                <input type="checkbox" id="gf-dv-todos" checked={dvTodos} onChange={toggleTodosDV} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                <label htmlFor="gf-dv-todos" className="text-xs text-ink font-medium cursor-pointer select-none">
                  {dvTodos ? "Quitar todos" : "Seleccionar todos"}
                </label>
                {dvSeleccionados.length > 0 && (
                  <button type="button" onClick={() => setDvSeleccionados([])} className="ml-auto text-xs text-muted hover:text-brand">Limpiar</button>
                )}
              </div>
              <div className="overflow-y-auto max-h-48 py-1">
                {dimValores.length === 0 ? (
                  <p className="text-xs text-muted px-3 py-2">Sin datos — subí el Excel de facturación</p>
                ) : dimValores.map((v) => (
                  <label key={v} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface cursor-pointer select-none">
                    <input type="checkbox" checked={dvSeleccionados.includes(v)} onChange={() => toggleDV(v)} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                    <span className="text-xs text-ink truncate">{v}</span>
                  </label>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-surface">
                <button type="button" onClick={() => setDvOpen(false)} className="w-full text-xs bg-brand text-white py-1.5 rounded-lg font-semibold hover:bg-brand/90 transition-colors">Aplicar</button>
              </div>
            </div>
          )}
        </div>

        {/* Clientes */}
        <div className="relative shrink-0" ref={clRef}>
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Cliente</label>
          <button
            type="button"
            onClick={() => { const next = !clOpen; setClOpen(next); if (next) reloadOptions(); }}
            className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors min-w-[180px] ${
              clientesSeleccionados.length > 0 ? "border-brand text-brand font-medium" : "border-border text-ink"
            }`}
          >
            <span className="flex-1 text-left truncate">{clLabel}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform ${clOpen ? "rotate-180" : ""}`} />
          </button>
          {clOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-xl w-72">
              <div className="flex border-b border-border">
                {(["excluir", "incluir"] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setClientesModo(m); setClientesSeleccionados([]); }}
                    className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${clientesModo === m ? "bg-brand text-white" : "text-muted hover:bg-surface"} ${m === "excluir" ? "rounded-tl-xl" : "rounded-tr-xl"}`}
                  >
                    {m === "excluir" ? "Ocultar seleccionados" : "Mostrar solo estos"}
                  </button>
                ))}
              </div>
              <div className="px-3 pt-2 pb-1">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={clSearch}
                  onChange={(e) => setClSearch(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface">
                <input type="checkbox" id="gf-cl-todos" checked={clTodos} onChange={toggleTodosCl} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                <label htmlFor="gf-cl-todos" className="text-xs text-ink font-medium cursor-pointer select-none">
                  {clTodos ? "Quitar todos" : "Seleccionar todos"}
                </label>
                {clientesSeleccionados.length > 0 && (
                  <button type="button" onClick={() => setClientesSeleccionados([])} className="ml-auto text-xs text-muted hover:text-brand">Limpiar</button>
                )}
              </div>
              <div className="overflow-y-auto max-h-48 py-1">
                {clientes.length === 0 ? (
                  <p className="text-xs text-muted px-3 py-2">Sin datos — subí el Excel de facturación</p>
                ) : clientesFiltrados.length === 0 ? (
                  <p className="text-xs text-muted px-3 py-2">Sin resultados</p>
                ) : clientesFiltrados.map((c) => (
                  <label key={c} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface cursor-pointer select-none">
                    <input type="checkbox" checked={clientesSeleccionados.includes(c)} onChange={() => toggleCl(c)} className="accent-brand w-3.5 h-3.5 cursor-pointer" />
                    <span className="text-xs text-ink truncate">{c}</span>
                  </label>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-surface">
                <button type="button" onClick={() => { setClOpen(false); setClSearch(""); }} className="w-full text-xs bg-brand text-white py-1.5 rounded-lg font-semibold hover:bg-brand/90 transition-colors">Aplicar</button>
              </div>
            </div>
          )}
        </div>

        {/* Limpiar + contador */}
        {hasFilters && (
          <div className="flex items-center gap-2 self-end mb-0.5">
            <span className="text-[11px] font-semibold text-brand bg-brand/10 rounded-full px-2 py-0.5">
              {[ccSeleccionados.length > 0, dvSeleccionados.length > 0, clientesSeleccionados.length > 0].filter(Boolean).length} filtro{[ccSeleccionados.length > 0, dvSeleccionados.length > 0, clientesSeleccionados.length > 0].filter(Boolean).length !== 1 ? "s" : ""} activo{[ccSeleccionados.length > 0, dvSeleccionados.length > 0, clientesSeleccionados.length > 0].filter(Boolean).length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={resetFilters}
              className="text-xs text-muted hover:text-brand border border-border px-3 py-1 rounded-lg hover:border-brand/50 transition-colors"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
