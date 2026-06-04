import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "default" | "green" | "red" | "amber";
  icon?: React.ReactNode;
}

const colorMap = {
  default: "border-border",
  green: "border-green-300",
  red: "border-red-300",
  amber: "border-amber-300",
};

export default function KpiCard({ label, value, sub, color = "default", icon }: KpiCardProps) {
  return (
    <div className={clsx("bg-white rounded-2xl border p-5 shadow-sm", colorMap[color])}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-ink mt-2 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}
