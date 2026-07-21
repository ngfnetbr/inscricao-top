import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, ClipboardList, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listarMinhasOficinas, type MinhaOficina } from "@/lib/chamada";

export const Route = createFileRoute("/chamada")({
  component: ChamadaIndex,
});

function ChamadaIndex() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [oficinas, setOficinas] = useState<MinhaOficina[]>([]);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!email) return;
    setCarregando(true);
    listarMinhasOficinas()
      .then(setOficinas)
      .catch(() => toast.error("Falha ao carregar oficinas."))
      .finally(() => setCarregando(false));
  }, [email]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!email) {
    return <LoginForm />;
  }

  const quinta = oficinas.filter((o) => o.dia === "quinta");
  const sexta = oficinas.filter((o) => o.dia === "sexta");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SME</p>
            <h1 className="text-base font-semibold text-foreground">Chamada de presença</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Início
        </Link>

        {carregando && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {!carregando && oficinas.length === 0 && (
          <div className="card-elevated p-6 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma oficina atribuída ao seu perfil. Fale com um administrador.
            </p>
          </div>
        )}

        {!carregando && oficinas.length > 0 && (
          <div className="space-y-6">
            {[
              { titulo: "Quinta-feira", lista: quinta },
              { titulo: "Sexta-feira", lista: sexta },
            ].map((sec) =>
              sec.lista.length === 0 ? null : (
                <section key={sec.titulo}>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {sec.titulo}
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {sec.lista.map((o) => (
                      <li key={o.id}>
                        <Link
                          to="/chamada/$oficinaId"
                          params={{ oficinaId: o.id }}
                          className="card-elevated block h-full p-4 transition hover:border-primary/60"
                        >
                          <p className="font-semibold text-foreground">{o.titulo}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{o.ministrante}</p>
                          {o.publico_alvo && (
                            <p className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                              {o.publico_alvo}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
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
    if (error) toast.error("Não foi possível entrar. Verifique e-mail e senha.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={entrar} className="card-elevated w-full max-w-sm p-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-foreground">Chamada — Gestor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesse com seu e-mail e senha.</p>

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
      </form>
    </div>
  );
}
