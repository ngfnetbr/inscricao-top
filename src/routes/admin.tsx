import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, Download, RefreshCw, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatarCpf } from "@/lib/format";
import { listarOficinas, type OficinaComVagas } from "@/lib/oficinas";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Inscricao = {
  id: string;
  cpf: string;
  nome: string;
  protocolo: string;
  criado_em: string;
  oficina_quinta_id: string;
  oficina_sexta_id: string;
};

function AdminPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessionEmail) return <LoginForm />;
  return <Painel email={sessionEmail} />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={entrar} className="card-elevated w-full max-w-sm p-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-foreground">Área administrativa</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesse com seu e-mail institucional.</p>

        <label className="mt-5 block text-sm font-medium">E-mail</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <label className="mt-4 block text-sm font-medium">Senha</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <button
          type="submit"
          disabled={carregando}
          className="brand-gradient mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold text-primary-foreground disabled:opacity-60"
        >
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          O acesso deve ser criado pelo administrador no painel do Lovable Cloud.
        </p>
      </form>
    </div>
  );
}

function Painel({ email }: { email: string }) {
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [oficinas, setOficinas] = useState<OficinaComVagas[]>([]);
  const [carregando, setCarregando] = useState(true);

  const mapaOficinas = useMemo(() => {
    const m = new Map<string, OficinaComVagas>();
    oficinas.forEach((o) => m.set(o.id, o));
    return m;
  }, [oficinas]);

  async function carregar() {
    setCarregando(true);
    const [insc, ofs] = await Promise.all([
      supabase.from("inscricoes").select("*").order("criado_em", { ascending: false }),
      listarOficinas(),
    ]);
    if (insc.error) toast.error("Falha ao carregar inscrições.");
    setInscricoes((insc.data ?? []) as Inscricao[]);
    setOficinas(ofs);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("admin-inscricoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inscricoes" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportarCsv() {
    const linhas = [
      ["Protocolo", "Nome", "CPF", "Oficina Quinta", "Ministrante Quinta", "Oficina Sexta", "Ministrante Sexta", "Data/hora"],
      ...inscricoes.map((i) => {
        const q = mapaOficinas.get(i.oficina_quinta_id);
        const s = mapaOficinas.get(i.oficina_sexta_id);
        return [
          i.protocolo,
          i.nome,
          formatarCpf(i.cpf),
          q?.titulo ?? "",
          q?.ministrante ?? "",
          s?.titulo ?? "",
          s?.ministrante ?? "",
          new Date(i.criado_em).toLocaleString("pt-BR"),
        ];
      }),
    ];
    const csv = linhas
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscricoes-oficinas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const quinta = oficinas.filter((o) => o.dia === "quinta");
  const sexta = oficinas.filter((o) => o.dia === "sexta");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SME</p>
            <h1 className="text-base font-semibold text-foreground">Painel de inscrições</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">Ocupação das oficinas</h2>
          <div className="flex gap-2">
            <button
              onClick={carregar}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            <button
              onClick={exportarCsv}
              className="brand-gradient inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <OcupacaoLista titulo="Quinta-feira" oficinas={quinta} />
          <OcupacaoLista titulo="Sexta-feira" oficinas={sexta} />
        </div>

        <h2 className="mt-8 mb-3 text-xl font-bold text-foreground">
          Inscrições ({inscricoes.length})
        </h2>

        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Protocolo</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Quinta</th>
                  <th className="px-4 py-3">Sexta</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {carregando && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!carregando && inscricoes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma inscrição registrada ainda.
                    </td>
                  </tr>
                )}
                {inscricoes.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-mono text-xs">{i.protocolo}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{i.nome}</td>
                    <td className="px-4 py-3">{formatarCpf(i.cpf)}</td>
                    <td className="px-4 py-3">{mapaOficinas.get(i.oficina_quinta_id)?.titulo ?? "—"}</td>
                    <td className="px-4 py-3">{mapaOficinas.get(i.oficina_sexta_id)?.titulo ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(i.criado_em).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function OcupacaoLista({ titulo, oficinas }: { titulo: string; oficinas: OficinaComVagas[] }) {
  return (
    <div className="card-elevated p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {oficinas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oficina.</p>}
      <ul className="space-y-3">
        {oficinas.map((o) => {
          const pct = Math.min(100, Math.round((o.inscritos / o.limite_vagas) * 100));
          return (
            <li key={o.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{o.titulo}</span>
                <span className={o.lotada ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {o.inscritos}/{o.limite_vagas}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${o.lotada ? "bg-destructive" : "brand-gradient"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
