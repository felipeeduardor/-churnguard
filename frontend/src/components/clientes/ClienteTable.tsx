"use client";
import { useState } from "react";
import Link from "next/link";
import { RiskBadge } from "./RiskBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Prediction, Segmento } from "@/types";

interface Props {
  predictions: Prediction[];
}

const PAGE_SIZE = 20;

const SEGMENTOS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os segmentos" },
  { value: "sem_risco", label: "Sem Risco" },
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Médio" },
  { value: "alto", label: "Alto" },
  { value: "critico", label: "Crítico" },
];

export function ClienteTable({ predictions }: Props) {
  const [search, setSearch] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState("all");
  const [regiaoFilter, setRegiaoFilter] = useState("all");
  const [page, setPage] = useState(1);

  const regioes = ["all", ...Array.from(new Set(predictions.map((p) => p.regiao))).sort()];

  const filtered = predictions.filter((p) => {
    const matchSearch = search === "" || String(p.codcli).includes(search);
    const matchSeg = segmentoFilter === "all" || p.segmento === segmentoFilter;
    const matchReg = regiaoFilter === "all" || p.regiao === regiaoFilter;
    return matchSearch && matchSeg && matchReg;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function onFilterChange() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por código..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onFilterChange();
          }}
          className="w-48"
        />
        <Select
          value={segmentoFilter}
          onValueChange={(v) => {
            setSegmentoFilter(v);
            onFilterChange();
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTOS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={regiaoFilter}
          onValueChange={(v) => {
            setRegiaoFilter(v);
            onFilterChange();
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            {regioes.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? "Todas as regiões" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex items-center text-sm text-muted-foreground">
          {filtered.length} clientes
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Região</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receita Total</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Frequência</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prob. Churn</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Segmento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ação</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              paginated.map((p) => (
                <tr
                  key={p.codcli}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">#{p.codcli}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.regiao}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.vl_nota_sum)}</td>
                  <td className="px-4 py-3 text-right">{p.frequencia_compras}x</td>
                  <td className="px-4 py-3 text-right font-medium">
                    <span
                      className={
                        p.probabilidade_churn > 0.6
                          ? "text-red-600"
                          : p.probabilidade_churn > 0.4
                          ? "text-yellow-600"
                          : "text-green-600"
                      }
                    >
                      {formatPercent(p.probabilidade_churn)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge segmento={p.segmento} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${p.codcli}`}
                      className="text-primary hover:underline text-xs"
                    >
                      Ver detalhes →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
