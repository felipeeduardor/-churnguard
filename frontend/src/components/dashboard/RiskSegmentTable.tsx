import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/clientes/RiskBadge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Prediction } from "@/types";
import Link from "next/link";

interface Props {
  predictions: Prediction[];
}

export function RiskSegmentTable({ predictions }: Props) {
  const top10 = [...predictions]
    .sort((a, b) => b.probabilidade_churn - a.probabilidade_churn)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 10 Clientes Críticos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Região</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receita</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prob. Churn</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Segmento</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p) => (
                <tr key={p.codcli} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${p.codcli}`} className="font-medium text-primary hover:underline">
                      #{p.codcli}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.regiao}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.vl_nota_sum)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatPercent(p.probabilidade_churn)}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge segmento={p.segmento} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
