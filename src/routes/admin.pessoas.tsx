import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Save, Search, X, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatarCpf } from "@/lib/format";

export const Route = createFileRoute("/admin/pessoas")({
  component: PessoasPage,
});

type Pessoa = {
  id: string;
  nome: string;
  cpf: string;
  criado_em: string;
};

function PessoasPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [inscritosCpfs, setInscritosCpfs] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<Pessoa | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function checar(session: { user: { id: string; email?: string | null } } | null) {
      if (!session) {
        if (!cancelled) {
          setSessionEmail(null);
          setChecking(false);
          navigate({ to: "/admin" });
        }
        return;
      }
      const { obterPapel } = await import("@/lib/role");
      const papel = await obterPapel(session.user.id);
      if (cancelled) return;
      if (papel !== "admin") {
        navigate({ to: "/chamada" });
        return;
      }
      setSessionEmail(session.user.email ?? null);
      setChecking(false);
    }
    supabase.auth.getSession().then(({ data }) => checar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => checar(s));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function carregar() {
    setCarregando(true);
    const [{ data: ps, error }, { data: ins }] = await Promise.all([
      supabase.from("pessoas").select("*").order("nome"),
      supabase.from("inscricoes").select("cpf"),
    ]);
    if (error) toast.error("Falha ao carregar pessoas.");
    setPessoas((ps ?? []) as Pessoa[]);
    setInscritosCpfs(new Set((ins ?? []).map((i) => i.cpf as string)));
    setCarregando(false);
  }

  useEffect(() => {
    if (!sessionEmail) return;
    carregar();
  }, [sessionEmail]);

  const filtradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return pessoas;
    const digitos = f.replace(/\D/g, "");
    return pessoas.filter(
      (p) =>
        p.nome.toLowerCase().includes(f) || (digitos && p.cpf.includes(digitos)),
    );
  }, [filtro, pessoas]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-elevated w-full max-w-sm p-6 text-center">
          <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
          <Link
            to="/admin"
            className="brand-gradient mt-4 inline-flex h-10 items-center justify-center gap-1 rounded-lg px-4 text-sm font-semibold text-primary-foreground"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
              title="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SME</p>
              <h1 className="text-base font-semibold text-foreground">Base de pessoas</h1>
            </div>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:inline">{sessionEmail}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Pessoas cadastradas ({filtradas.length}
              {filtro && ` de ${pessoas.length}`})
            </h2>
            <p className="text-xs text-muted-foreground">
              Edição apenas de nome e CPF. Não cria inscrições.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">CPF</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {carregando && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!carregando && filtradas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma pessoa encontrada.
                    </td>
                  </tr>
                )}
                {filtradas.map((p) => {
                  const inscrito = inscritosCpfs.has(p.cpf);
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-3 font-medium text-foreground">{p.nome}</td>
                      <td className="px-3 py-3">{formatarCpf(p.cpf)}</td>
                      <td className="px-3 py-3">
                        {inscrito ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Users className="h-3 w-3" /> Inscrito
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setEditando(p)}
                            title="Editar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editando && (
        <ModalEditarPessoa
          pessoa={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function ModalEditarPessoa({
  pessoa,
  onFechar,
  onSalvo,
}: {
  pessoa: Pessoa;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(pessoa.nome);
  const [cpf, setCpf] = useState(formatarCpf(pessoa.cpf));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const nomeLimpo = nome.trim();
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (nomeLimpo.length < 3) {
      toast.error("Informe um nome válido.");
      return;
    }
    if (cpfLimpo.length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("pessoas")
      .update({ nome: nomeLimpo, cpf: cpfLimpo })
      .eq("id", pessoa.id);
    setSalvando(false);
    if (error) {
      if (error.code === "23505") toast.error("Já existe uma pessoa com esse CPF.");
      else toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Pessoa atualizada.");
    onSalvo();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onFechar}
    >
      <div
        className="card-elevated w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Editar pessoa</h3>
          <button onClick={onFechar} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm font-medium">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <label className="mt-4 block text-sm font-medium">CPF</label>
        <input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <p className="mt-3 text-xs text-muted-foreground">
          A alteração aqui não afeta inscrições já feitas com o CPF anterior.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onFechar}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-card px-4 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="brand-gradient inline-flex h-10 items-center gap-1 rounded-lg px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
