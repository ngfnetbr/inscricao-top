import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save, X, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listarOficinas, type OficinaComVagas } from "@/lib/oficinas";
import { criarGestor, removerGestor, definirOficinasGestor } from "@/lib/gestores.functions";

export const Route = createFileRoute("/admin/gestores")({
  component: AdminGestores,
});

type Gestor = { user_id: string; email: string; oficinas: { id: string; titulo: string; dia: string }[] };

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setChecking(false);
      if (!data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data, error }, ofs] = await Promise.all([
        supabase.rpc("admin_listar_gestores"),
        listarOficinas(true),
      ]);
      if (error) throw error;
      setGestores((data ?? []) as Gestor[]);
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
          <ul className="card-elevated divide-y divide-border overflow-hidden">
            {gestores.map((g) => (
              <li key={g.user_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{g.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {g.oficinas.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nenhuma oficina atribuída</span>
                      )}
                      {g.oficinas.map((o) => (
                        <span
                          key={o.id}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                        >
                          {o.dia === "quinta" ? "Q" : "S"} · {o.titulo}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditando(g)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
                    >
                      Editar oficinas
                    </button>
                    <button
                      onClick={() => excluir(g)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
          criar={async (email, senha, ids) => {
            await criarFn({ data: { email, senha, oficinaIds: ids } });
          }}
        />
      )}

      {editando && (
        <ModalEditarOficinas
          gestor={editando}
          oficinas={oficinas}
          onFechar={() => setEditando(null)}
          onSalvar={async (ids) => {
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
  criar: (email: string, senha: string, ids: string[]) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await criar(email, senha, selecionadas);
      toast.success("Gestor criado.");
      onSalvo();
    } catch (err) {
      toast.error("Falha ao criar gestor.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalShell titulo="Novo gestor" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
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

function ModalEditarOficinas({
  gestor,
  oficinas,
  onFechar,
  onSalvar,
}: {
  gestor: Gestor;
  oficinas: OficinaComVagas[];
  onFechar: () => void;
  onSalvar: (ids: string[]) => Promise<void>;
}) {
  const [sel, setSel] = useState<string[]>(gestor.oficinas.map((o) => o.id));
  const [salvando, setSalvando] = useState(false);

  return (
    <ModalShell titulo={`Oficinas de ${gestor.email}`} onFechar={onFechar}>
      <ListaOficinas
        oficinas={oficinas}
        selecionadas={sel}
        onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onFechar} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          Cancelar
        </button>
        <button
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await onSalvar(sel);
              toast.success("Atribuições atualizadas.");
            } catch {
              toast.error("Falha ao salvar.");
            } finally {
              setSalvando(false);
            }
          }}
          className="brand-gradient inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
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
