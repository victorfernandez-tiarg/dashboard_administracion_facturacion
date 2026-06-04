import { useEffect, useState } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import toast from "react-hot-toast";
import api from "../api";

const fmt = (v: number) => `$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtUSD = (v: number) => `USD ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [saldos, setSaldos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get("/data/facturacion-por-cliente"), api.get("/data/cc-saldos")])
      .then(([f, s]) => { setClientes(f.data); setSaldos(s.data); })
      .catch(() => toast.error("Error al cargar clientes"))
      .finally(() => setLoading(false));
  }, []);

  const saldoMap = Object.fromEntries(saldos.map((s) => [s.cliente?.toLowerCase(), s]));

  const filtrados = clientes.filter((c) =>
    !search || c.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const clienteSelected = selected ? clientes.find((c) => c.cliente === selected) : null;
  const saldoSelected = selected ? saldoMap[selected.toLowerCase()] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Clientes</h1>
        <input
          className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-56"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-muted text-sm animate-pulse">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Total ARS</th>
                    <th className="px-4 py-3 text-right">Total USD</th>
                    <th className="px-4 py-3 text-right">Deuda</th>
                    <th className="px-4 py-3">Aging</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {filtrados.slice(0, 100).map((c) => {
                    const s = saldoMap[c.cliente?.toLowerCase()];
                    return (
                      <tr
                        key={c.cliente}
                        className={`hover:bg-surface/80 cursor-pointer transition-colors ${selected === c.cliente ? "bg-brand/5" : ""}`}
                        onClick={() => setSelected(selected === c.cliente ? null : c.cliente)}
                      >
                        <td className="px-4 py-2 font-medium text-ink">{c.cliente}</td>
                        <td className="px-4 py-2 text-right text-muted">{fmt(parseFloat(c.total_ars))}</td>
                        <td className="px-4 py-2 text-right text-muted">{fmtUSD(parseFloat(c.total_usd))}</td>
                        <td className="px-4 py-2 text-right">{s ? fmt(parseFloat(s.saldo_actual)) : "-"}</td>
                        <td className="px-4 py-2">
                          {s?.aging ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted font-medium">{s.aging}</span>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel detalle */}
          <div className="bg-white border border-border rounded-2xl shadow-sm p-5">
            {clienteSelected ? (
              <div className="space-y-4">
                <h2 className="font-bold text-ink text-base">{clienteSelected.cliente}</h2>
                <p className="text-xs text-muted">{clienteSelected.razon_social}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Facturas</span><span className="font-medium">{clienteSelected.cantidad_facturas}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Total ARS</span><span className="font-medium">{fmt(parseFloat(clienteSelected.total_ars))}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Total USD</span><span className="font-medium">{fmtUSD(parseFloat(clienteSelected.total_usd))}</span></div>
                  {saldoSelected && <>
                    <hr className="border-border" />
                    <div className="flex justify-between"><span className="text-muted">Saldo actual</span><span className="font-semibold text-red-600">{fmt(parseFloat(saldoSelected.saldo_actual))}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Saldo vencido</span><span className="font-medium">{fmt(parseFloat(saldoSelected.saldo_vencido))}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Aging</span><span className="font-medium">{saldoSelected.aging}</span></div>
                  </>}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted text-sm py-8">
                <p>Seleccioná un cliente</p>
                <p className="text-xs mt-1">para ver el detalle</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
