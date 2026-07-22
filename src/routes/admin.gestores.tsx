import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save, X, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listarOficinas, type OficinaComVagas } from "@/lib/oficinas";
import { criarGestor, removerGestor, definirOficinasGestor, atualizarGestor } from "@/lib/gestores.functions";

export const Route = createFileRoute("/admin/gestores")({
  component: AdminGestores,
});

type Gestor = { user_id: string; email: string; nome: string | null; oficinas: { id: string; titulo: string; dia: string }[] };

function AdminGestores() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [oficinas, setOficinas] = useState<OficinaComVagas[]>([]);
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState<Gestor | null>(null);
  const navigate = useNavigate();

  const criarFn = useServerFn(criarGestor);
  const removerFn = useServerFn(removerGestor);
  const definirFn = useServerFn(definirOficinasGestor);
  const atualizarFn = useServerFn(atualizarGestor);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setChecking(false);
        navigate({ to: "/admin" });
        return;
      }
      const { obterPapel } = await import("@/lib/role");
      const papel = await obterPapel(data.session.user.id);
      if (papel !== "admin") {
        setChecking(false);
        navigate({ to: "/chamada" });
        return;
      }
      setEmail(data.session.user.email ?? null);
      setChecking(false);
    })();
  }, [navigate]);

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data, error }, ofs] = await Promise.all([
        supabase.rpc("admin_listar_gestores"),
        listarOficinas(true),
      ]);
      if (error) throw error;
      setGestores((data ?? []) as unknown as Gestor[]);
      setOficinas(ofs);
    } catch {
      toast.error("Falha ao carregar gestores.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (email) carregar();
  }, [email]);

  async function excluir(g: Gestor) {
    if (!window.confirm(`Remover o gestor ${g.email}? A conta é mantida, mas perde o acesso de gestor.`)) return;
    try {
      await removerFn({ data: { userId: g.user_id } });
      toast.success("Gestor removido.");
      carregar();
    } catch {
      toast.error("Falha ao remover.");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Painel
            </Link>
            <h1 className="text-base font-semibold text-foreground">Gestores</h1>
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

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Gestores fazem a chamada de presença apenas nas oficinas atribuídas.
          </p>
          <button
            onClick={() => setModalNovo(true)}
            className="brand-gradient inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Novo gestor
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : gestores.length === 0 ? (
          <p className="card-elevated p-6 text-center text-sm text-muted-foreground">
            Nenhum gestor cadastrado.
          </p>
        ) : (
          (() => {
            const grupos = new Map<string, { titulo: string; ministrante: string; dia: string; ordem: number; gestores: Gestor[] }>();
            oficinas.forEach((o, idx) => {
              grupos.set(o.id, { titulo: o.titulo, ministrante: o.ministrante, dia: o.dia, ordem: idx, gestores: [] });
            });
            const semOficina: Gestor[] = [];
            gestores.forEach((g) => {
              if (g.oficinas.length === 0) {
                semOficina.push(g);
                return;
              }
              g.oficinas.forEach((o) => {
                const grp = grupos.get(o.id);
                if (grp) grp.gestores.push(g);
                else {
                  grupos.set(o.id, { titulo: o.titulo, ministrante: "", dia: o.dia, ordem: 9999, gestores: [g] });
                }
              });
            });
            const ordenados = Array.from(grupos.entries())
              .sort((a, b) => {
                if (a[1].dia !== b[1].dia) return a[1].dia === "quinta" ? -1 : 1;
                return a[1].ordem - b[1].ordem;
              });
            const semGestor = ordenados.filter(([, v]) => v.gestores.length === 0);

            const renderGestor = (g: Gestor) => (
              <li key={g.user_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{g.nome || "(sem nome)"}</p>
                  <p className="text-xs font-medium text-primary">{g.email}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditando(g)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => excluir(g)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );

            return (
              <div className="space-y-5">
                {semGestor.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-sm font-semibold text-destructive">
                      {semGestor.length} oficina(s) sem gestor atribuído
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {semGestor.map(([id, grp]) => (
                        <li key={id} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          {grp.dia === "quinta" ? "Q" : "S"} · {grp.titulo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ordenados.map(([id, grp]) => (
                  <section key={id} className="card-elevated overflow-hidden">
                    <header className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${grp.dia === "quinta" ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent-foreground"}`}>
                          {grp.dia === "quinta" ? "Quinta" : "Sexta"}
                        </span>
                        <div>
                          <h2 className="text-sm font-semibold text-foreground">{grp.titulo}</h2>
                          {grp.ministrante && (
                            <p className="text-xs text-muted-foreground">{grp.ministrante}</p>
                          )}
                        </div>
                      </div>
                      {grp.gestores.length === 0 ? (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                          Sem gestor
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{grp.gestores.length} gestor(es)</span>
                      )}
                    </header>
                    {grp.gestores.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum gestor atribuído a esta oficina.</p>
                    ) : (
                      <ul className="divide-y divide-border">{grp.gestores.map(renderGestor)}</ul>
                    )}
                  </section>
                ))}
                {semOficina.length > 0 && (
                  <section className="card-elevated overflow-hidden">
                    <header className="border-b border-border bg-muted/40 px-4 py-2">
                      <h2 className="text-sm font-semibold text-foreground">Sem oficina atribuída</h2>
                    </header>
                    <ul className="divide-y divide-border">{semOficina.map(renderGestor)}</ul>
                  </section>
                )}
              </div>
            );
          })()
        )}
      </main>

      {modalNovo && (
        <ModalNovoGestor
          oficinas={oficinas}
          onFechar={() => setModalNovo(false)}
          onSalvo={() => {
            setModalNovo(false);
            carregar();
          }}
          criar={async (nome, email, senha, ids) => {
            await criarFn({ data: { nome, email, senha, oficinaIds: ids } });
          }}
        />
      )}

      {editando && (
        <ModalEditarGestor
          gestor={editando}
          oficinas={oficinas}
          onFechar={() => setEditando(null)}
          onSalvar={async ({ nome, senha, ids }) => {
            await atualizarFn({ data: { userId: editando.user_id, nome, senha } });
            await definirFn({ data: { userId: editando.user_id, oficinaIds: ids } });
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function ModalNovoGestor({
  oficinas,
  onFechar,
  onSalvo,
  criar,
}: {
  oficinas: OficinaComVagas[];
  onFechar: () => void;
  onSalvo: () => void;
  criar: (nome: string, email: string, senha: string, ids: string[]) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await criar(nome.trim(), email, senha, selecionadas);
      toast.success("Gestor criado.");
      onSalvo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar gestor.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalShell titulo="Novo gestor" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nome do gestor</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Senha (mín. 6 caracteres)</label>
          <input
            type="text"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <ListaOficinas oficinas={oficinas} selecionadas={selecionadas} onToggle={(id) => {
          setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
        }} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="brand-gradient inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Criar
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalEditarGestor({
  gestor,
  oficinas,
  onFechar,
  onSalvar,
}: {
  gestor: Gestor;
  oficinas: OficinaComVagas[];
  onFechar: () => void;
  onSalvar: (v: { nome: string; senha: string; ids: string[] }) => Promise<void>;
}) {
  const [nome, setNome] = useState(gestor.nome ?? "");
  const [senha, setSenha] = useState("");
  const [sel, setSel] = useState<string[]>(gestor.oficinas.map((o) => o.id));
  const [salvando, setSalvando] = useState(false);

  return (
    <ModalShell titulo={`Editar ${gestor.email}`} onFechar={onFechar}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nome do gestor</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nova senha (opcional)</label>
          <input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Deixe em branco para manter"
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
        </div>
        <ListaOficinas
          oficinas={oficinas}
          selecionadas={sel}
          onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            disabled={salvando}
            onClick={async () => {
              const s = senha.trim();
              if (s && s.length < 6) {
                toast.error("Senha deve ter no mínimo 6 caracteres.");
                return;
              }
              setSalvando(true);
              try {
                await onSalvar({ nome: nome.trim(), senha: s, ids: sel });
                toast.success("Gestor atualizado.");
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Falha ao salvar.";
                toast.error(msg);
              } finally {
                setSalvando(false);
              }
            }}
            className="brand-gradient inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ListaOficinas({
  oficinas,
  selecionadas,
  onToggle,
}: {
  oficinas: OficinaComVagas[];
  selecionadas: string[];
  onToggle: (id: string) => void;
}) {
  const quinta = oficinas.filter((o) => o.dia === "quinta");
  const sexta = oficinas.filter((o) => o.dia === "sexta");
  return (
    <div className="space-y-3">
      {[
        { titulo: "Quinta-feira", lista: quinta },
        { titulo: "Sexta-feira", lista: sexta },
      ].map((sec) => (
        <div key={sec.titulo}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.titulo}</p>
          <ul className="space-y-1">
            {sec.lista.map((o) => {
              const marcada = selecionadas.includes(o.id);
              return (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => onToggle(o.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-foreground">{o.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{o.ministrante}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ModalShell({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
          <button onClick={onFechar} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
