"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient } from "@/lib/supabase";
import { Plus, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { ActionPlan } from "@/types";

interface Props {
  predictionId: string;
  orgId: string;
}

const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Clock, variant: "warning" as const },
  em_andamento: { label: "Em Andamento", icon: AlertCircle, variant: "info" as const },
  concluido: { label: "Concluído", icon: CheckCircle2, variant: "success" as const },
};

export function ActionPlanSection({ predictionId, orgId }: Props) {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    responsavel: "",
    prazo: "",
    status: "pendente" as ActionPlan["status"],
  });

  const supabase = getSupabaseClient();

  useEffect(() => {
    loadPlans();
  }, [predictionId]);

  async function loadPlans() {
    setLoading(true);
    const { data } = await supabase
      .from("action_plans")
      .select("*")
      .eq("prediction_id", predictionId)
      .order("created_at", { ascending: false });
    setPlans(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase.from("action_plans").insert({
      prediction_id: predictionId,
      org_id: orgId,
      ...form,
    });

    setForm({ descricao: "", responsavel: "", prazo: "", status: "pendente" });
    setShowForm(false);
    setSaving(false);
    loadPlans();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Planos de Ação</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Novo plano
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border rounded-md p-4 space-y-3 bg-muted/20"
          >
            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição da ação</Label>
              <Input
                id="descricao"
                placeholder="Ex: Entrar em contato com oferta especial"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  placeholder="Nome do responsável"
                  value={form.responsavel}
                  onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prazo">Prazo</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={form.prazo}
                  onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Plans list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando planos...
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum plano de ação criado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const config = STATUS_CONFIG[plan.status];
              const Icon = config.icon;
              return (
                <div
                  key={plan.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{plan.descricao}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {plan.responsavel && <span>👤 {plan.responsavel}</span>}
                      {plan.prazo && (
                        <span>
                          📅{" "}
                          {new Date(plan.prazo).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={config.variant} className="shrink-0 flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
