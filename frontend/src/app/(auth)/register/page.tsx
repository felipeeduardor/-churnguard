"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = getSupabaseClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? "Erro ao criar conta");
      setLoading(false);
      return;
    }

    // 2. Sign in to establish session before creating org
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
      setLoading(false);
      return;
    }

    // 3. Create org + profile via RPC (SECURITY DEFINER, bypasses RLS)
    const { error: rpcError } = await supabase.rpc("register_organization", {
      org_name: orgName,
      user_name: name,
    });

    if (rpcError) {
      setError("Erro ao configurar conta: " + rpcError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <Card className="auth-card w-full max-w-md mx-4 border border-white/10 shadow-2xl shadow-indigo-900/40 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingDown className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Loyalto</span>
        </div>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Comece a monitorar o churn da sua empresa</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              placeholder="João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgName">Nome da empresa</Label>
            <Input
              id="orgName"
              placeholder="Minha Empresa Ltda"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar conta
          </Button>
        </form>
      </CardContent>

      <CardFooter className="text-center text-sm">
        <span className="text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Entrar
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
