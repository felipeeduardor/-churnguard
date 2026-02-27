import { cn } from "@/lib/utils";
import type { Segmento } from "@/types";

interface Props {
  segmento: Segmento;
  className?: string;
}

const CONFIG: Record<Segmento, { label: string; className: string }> = {
  sem_risco: {
    label: "Sem Risco",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  baixo: {
    label: "Baixo",
    className: "bg-lime-100 text-lime-800 border-lime-200",
  },
  medio: {
    label: "Médio",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  alto: {
    label: "Alto",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  critico: {
    label: "Crítico",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

export function RiskBadge({ segmento, className }: Props) {
  const config = CONFIG[segmento] ?? CONFIG.medio;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
