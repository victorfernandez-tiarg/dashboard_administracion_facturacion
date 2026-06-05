import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

export const DEFAULT_DESDE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();
export const DEFAULT_HASTA = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

interface GlobalFiltersCtx {
  filtroDesde: string;
  filtroHasta: string;
  ccModo: "incluir" | "excluir";
  ccSeleccionados: string[];
  dvModo: "incluir" | "excluir";
  dvSeleccionados: string[];
  centrosCosto: string[];
  dimValores: string[];
  setFiltroDesde: (v: string) => void;
  setFiltroHasta: (v: string) => void;
  setCcModo: (m: "incluir" | "excluir") => void;
  setCcSeleccionados: React.Dispatch<React.SetStateAction<string[]>>;
  setDvModo: (m: "incluir" | "excluir") => void;
  setDvSeleccionados: React.Dispatch<React.SetStateAction<string[]>>;
  clientesModo: "incluir" | "excluir";
  clientesSeleccionados: string[];
  clientes: string[];
  setClientesModo: (m: "incluir" | "excluir") => void;
  setClientesSeleccionados: React.Dispatch<React.SetStateAction<string[]>>;
  buildParams: () => Record<string, string>;
  hasFilters: boolean;
  resetFilters: () => void;
  reloadOptions: () => void;
}

const GlobalFiltersContext = createContext<GlobalFiltersCtx>({} as GlobalFiltersCtx);

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filtroDesde, setFiltroDesde] = useState(DEFAULT_DESDE);
  const [filtroHasta, setFiltroHasta] = useState(DEFAULT_HASTA);
  const [ccModo, setCcModo] = useState<"incluir" | "excluir">("excluir");
  const [ccSeleccionados, setCcSeleccionados] = useState<string[]>([]);
  const [dvModo, setDvModo] = useState<"incluir" | "excluir">("excluir");
  const [dvSeleccionados, setDvSeleccionados] = useState<string[]>([]);
  const [clientesModo, setClientesModo] = useState<"incluir" | "excluir">("excluir");
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<string[]>([]);
  const [dimValores, setDimValores] = useState<string[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);

  const loadOptions = useCallback(() => {
    api.get("/data/centros-costo").then((r) => setCentrosCosto(r.data)).catch((e) => console.error("centros-costo:", e));
    api.get("/data/dim-valores").then((r) => setDimValores(r.data)).catch((e) => console.error("dim-valores:", e));
    api.get("/data/clientes").then((r) => setClientes(r.data)).catch((e) => console.error("clientes:", e));
  }, []);

  useEffect(() => {
    loadOptions();
  }, []);

  const buildParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {};
    if (filtroDesde) p.fecha_desde = filtroDesde;
    if (filtroHasta) p.fecha_hasta = filtroHasta;
    if (ccSeleccionados.length > 0)
      p[ccModo === "excluir" ? "cc_excluir" : "cc_incluir"] = ccSeleccionados.join(",");
    if (dvSeleccionados.length > 0)
      p[dvModo === "excluir" ? "dv_excluir" : "dv_incluir"] = dvSeleccionados.join(",");
    if (clientesSeleccionados.length > 0)
      p[clientesModo === "excluir" ? "cliente_excluir" : "cliente_incluir"] = clientesSeleccionados.join(",");
    return p;
  }, [filtroDesde, filtroHasta, ccModo, ccSeleccionados, dvModo, dvSeleccionados]);

  const hasFilters =
    ccSeleccionados.length > 0 ||
    dvSeleccionados.length > 0 ||
    clientesSeleccionados.length > 0 ||
    filtroDesde !== DEFAULT_DESDE ||
    filtroHasta !== DEFAULT_HASTA;

  const resetFilters = useCallback(() => {
    setCcSeleccionados([]);
    setDvSeleccionados([]);
    setClientesSeleccionados([]);
    setFiltroDesde(DEFAULT_DESDE);
    setFiltroHasta(DEFAULT_HASTA);
  }, []);

  const reloadOptions = useCallback(() => {
    api.get("/data/centros-costo").then((r) => setCentrosCosto(r.data)).catch((e) => console.error("centros-costo reload:", e));
    api.get("/data/dim-valores").then((r) => setDimValores(r.data)).catch((e) => console.error("dim-valores reload:", e));
    api.get("/data/clientes").then((r) => setClientes(r.data)).catch((e) => console.error("clientes reload:", e));
  }, []);

  return (
    <GlobalFiltersContext.Provider value={{
      filtroDesde, filtroHasta,
      ccModo, ccSeleccionados,
      dvModo, dvSeleccionados,
      centrosCosto, dimValores, clientes,
      setFiltroDesde, setFiltroHasta,
      setCcModo, setCcSeleccionados,
      setDvModo, setDvSeleccionados,
      setClientesModo, setClientesSeleccionados,
      clientesModo, clientesSeleccionados,
      buildParams, hasFilters, resetFilters, reloadOptions,
    }}>
      {children}
    </GlobalFiltersContext.Provider>
  );
}

export function useGlobalFilters() {
  return useContext(GlobalFiltersContext);
}
