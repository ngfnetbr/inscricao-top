import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  Download,
  RefreshCw,
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Minus,
  Power,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Users,
  Settings,
  ClipboardList,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { formatarCpf } from "@/lib/format";
import { listarOficinas, type OficinaComVagas } from "@/lib/oficinas";

export const Route = createFileRoute("/admin/")({
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
    if (error) toast.error("Não foi possível entrar. Verifique e-mail e senha.");
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
      </form>
    </div>
  );
}

function Painel({ email }: { email: string }) {
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [oficinas, setOficinas] = useState<OficinaComVagas[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<Inscricao | null>(null);
  const [editandoOficina, setEditandoOficina] = useState<OficinaComVagas | null>(null);
  const [oficinaAberta, setOficinaAberta] = useState<string | null>(null);

  const mapaOficinas = useMemo(() => {
    const m = new Map<string, OficinaComVagas>();
    oficinas.forEach((o) => m.set(o.id, o));
    return m;
  }, [oficinas]);

  async function carregar() {
    setCarregando(true);
    const [insc, ofs] = await Promise.all([
      supabase.from("inscricoes").select("*").order("criado_em", { ascending: false }),
      listarOficinas(true),
    ]);
    if (insc.error) toast.error("Falha ao carregar inscrições.");
    setInscricoes((insc.data ?? []) as Inscricao[]);
    setOficinas(ofs);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inscricoes" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "oficinas" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ajustarVagas(o: OficinaComVagas, delta: number) {
    const novo = Math.max(o.inscritos, o.limite_vagas + delta);
    if (novo === o.limite_vagas) return;
    const { error } = await supabase.from("oficinas").update({ limite_vagas: novo }).eq("id", o.id);
    if (error) toast.error("Não foi possível atualizar vagas.");
    else {
      toast.success(`Vagas de "${o.titulo}" agora: ${novo}`);
      carregar();
    }
  }

  async function alternarAtiva(o: OficinaComVagas) {
    if (o.ativa && o.inscritos > 0) {
      if (!window.confirm(`"${o.titulo}" possui ${o.inscritos} inscritos. Desativar mesmo assim?`)) return;
    }
    const { error } = await supabase.from("oficinas").update({ ativa: !o.ativa }).eq("id", o.id);
    if (error) toast.error("Falha ao alterar status.");
    else carregar();
  }

  async function excluirInscricao(i: Inscricao) {
    if (!window.confirm(`Excluir a inscrição de ${i.nome}?`)) return;
    const { error } = await supabase.from("inscricoes").delete().eq("id", i.id);
    if (error) toast.error("Falha ao excluir.");
    else {
      toast.success("Inscrição excluída.");
      carregar();
    }
  }

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
    const csv = linhas.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
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

  // participantes agrupados por oficina
  const participantesPorOficina = useMemo(() => {
    const m = new Map<string, Inscricao[]>();
    inscricoes.forEach((i) => {
      for (const oid of [i.oficina_quinta_id, i.oficina_sexta_id]) {
        const arr = m.get(oid) ?? [];
        arr.push(i);
        m.set(oid, arr);
      }
    });
    // ordenar por nome
    m.forEach((arr) => arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return m;
  }, [inscricoes]);

  const inscricoesFiltradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return inscricoes;
    return inscricoes.filter((i) => {
      const q = mapaOficinas.get(i.oficina_quinta_id);
      const s = mapaOficinas.get(i.oficina_sexta_id);
      return (
        i.nome.toLowerCase().includes(f) ||
        i.cpf.includes(f.replace(/\D/g, "")) ||
        i.protocolo.toLowerCase().includes(f) ||
        (q?.titulo.toLowerCase().includes(f) ?? false) ||
        (s?.titulo.toLowerCase().includes(f) ?? false)
      );
    });
  }, [filtro, inscricoes, mapaOficinas]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SME</p>
            <h1 className="text-base font-semibold text-foreground">Painel administrativo</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <Link
              to="/admin/gestores"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4" /> Gestores
            </Link>
            <Link
              to="/chamada"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <ClipboardList className="h-4 w-4" /> Chamada
            </Link>
            <Link
              to="/admin/pessoas"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <Users className="h-4 w-4" /> Pessoas
            </Link>
            <Link
              to="/certificado"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <ClipboardList className="h-4 w-4" /> Certificados
            </Link>
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
          <h2 className="text-xl font-bold text-foreground">Oficinas e ocupação</h2>
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
          <OcupacaoLista
            titulo="Quinta-feira"
            oficinas={quinta}
            participantesPorOficina={participantesPorOficina}
            oficinaAberta={oficinaAberta}
            setOficinaAberta={setOficinaAberta}
            onMais={(o) => ajustarVagas(o, 1)}
            onMenos={(o) => ajustarVagas(o, -1)}
            onEditar={setEditandoOficina}
            onAlternar={alternarAtiva}
          />
          <OcupacaoLista
            titulo="Sexta-feira"
            oficinas={sexta}
            participantesPorOficina={participantesPorOficina}
            oficinaAberta={oficinaAberta}
            setOficinaAberta={setOficinaAberta}
            onMais={(o) => ajustarVagas(o, 1)}
            onMenos={(o) => ajustarVagas(o, -1)}
            onEditar={setEditandoOficina}
            onAlternar={alternarAtiva}
          />
        </div>

        <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-foreground">
            Inscrições ({inscricoesFiltradas.length}
            {filtro && ` de ${inscricoes.length}`})
          </h2>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nome, CPF, protocolo ou oficina..."
            className="h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Protocolo</th>
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">CPF</th>
                  <th className="px-3 py-3">Quinta</th>
                  <th className="px-3 py-3">Sexta</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {carregando && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!carregando && inscricoesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma inscrição encontrada.
                    </td>
                  </tr>
                )}
                {inscricoesFiltradas.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-3 font-mono text-xs">{i.protocolo}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{i.nome}</td>
                    <td className="px-3 py-3">{formatarCpf(i.cpf)}</td>
                    <td className="px-3 py-3">{mapaOficinas.get(i.oficina_quinta_id)?.titulo ?? "—"}</td>
                    <td className="px-3 py-3">{mapaOficinas.get(i.oficina_sexta_id)?.titulo ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {new Date(i.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditando(i)}
                          title="Editar / Transferir"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => excluirInscricao(i)}
                          title="Excluir"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editando && (
        <ModalEditar
          inscricao={editando}
          oficinas={oficinas}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      {editandoOficina && (
        <ModalEditarOficina
          oficina={editandoOficina}
          onFechar={() => setEditandoOficina(null)}
          onSalvo={() => {
            setEditandoOficina(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function OcupacaoLista({
  titulo,
  oficinas,
  participantesPorOficina,
  oficinaAberta,
  setOficinaAberta,
  onMais,
  onMenos,
  onEditar,
  onAlternar,
}: {
  titulo: string;
  oficinas: OficinaComVagas[];
  participantesPorOficina: Map<string, Inscricao[]>;
  oficinaAberta: string | null;
  setOficinaAberta: (id: string | null) => void;
  onMais: (o: OficinaComVagas) => void;
  onMenos: (o: OficinaComVagas) => void;
  onEditar: (o: OficinaComVagas) => void;
  onAlternar: (o: OficinaComVagas) => void;
}) {
  return (
    <div className="card-elevated p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {oficinas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oficina.</p>}
      <ul className="space-y-4">
        {oficinas.map((o) => {
          const pct = Math.min(100, Math.round((o.inscritos / Math.max(1, o.limite_vagas)) * 100));
          const aberta = oficinaAberta === o.id;
          const participantes = participantesPorOficina.get(o.id) ?? [];
          return (
            <li key={o.id} className={o.ativa ? "" : "opacity-60"}>
              <div className="mb-1 flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{o.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.ministrante}</p>
                  {o.publico_alvo && (
                    <p className="mt-0.5 truncate text-[11px] text-primary/80">{o.publico_alvo}</p>
                  )}
                </div>
                <span className={o.lotada ? "shrink-0 font-semibold text-destructive" : "shrink-0 text-muted-foreground"}>
                  {o.inscritos}/{o.limite_vagas}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${o.lotada ? "bg-destructive" : "brand-gradient"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <button
                  onClick={() => onMenos(o)}
                  disabled={o.limite_vagas <= o.inscritos}
                  title="Reduzir uma vaga"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onMais(o)}
                  title="Adicionar uma vaga"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onEditar(o)}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-muted"
                >
                  <Settings className="h-3 w-3" /> Editar
                </button>
                <button
                  onClick={() => onAlternar(o)}
                  className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs ${o.ativa ? "border-border bg-card hover:bg-muted" : "border-primary/40 bg-primary/10 text-primary"}`}
                >
                  <Power className="h-3 w-3" /> {o.ativa ? "Ativa" : "Inativa"}
                </button>
                <button
                  onClick={() => setOficinaAberta(aberta ? null : o.id)}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-muted"
                >
                  <Users className="h-3 w-3" /> Participantes ({participantes.length})
                  {aberta ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              {aberta && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
                  {participantes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum inscrito ainda.</p>
                  ) : (
                    <ol className="space-y-1 text-sm">
                      {participantes.map((p, idx) => (
                        <li key={p.id} className="flex items-baseline gap-2">
                          <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{idx + 1}.</span>
                          <span className="flex-1 text-foreground">{p.nome}</span>
                          <span className="text-xs text-muted-foreground">{formatarCpf(p.cpf)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ModalEditar({
  inscricao,
  oficinas,
  onFechar,
  onSalvo,
}: {
  inscricao: Inscricao;
  oficinas: OficinaComVagas[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(inscricao.nome);
  const [quintaId, setQuintaId] = useState(inscricao.oficina_quinta_id);
  const [sextaId, setSextaId] = useState(inscricao.oficina_sexta_id);
  const [salvando, setSalvando] = useState(false);

  const quintas = oficinas.filter((o) => o.dia === "quinta");
  const sextas = oficinas.filter((o) => o.dia === "sexta");

  async function salvar() {
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 3) {
      toast.error("Informe um nome válido.");
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.rpc("admin_atualizar_inscricao", {
      _inscricao_id: inscricao.id,
      _oficina_quinta: quintaId,
      _oficina_sexta: sextaId,
      _nome: nomeLimpo,
    });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    const status = (data as { status?: string })?.status;
    if (status === "sucesso") {
      toast.success("Inscrição atualizada.");
      onSalvo();
    } else if (status === "oficina_quinta_lotada") toast.error("Oficina de quinta lotada.");
    else if (status === "oficina_sexta_lotada") toast.error("Oficina de sexta lotada.");
    else if (status === "oficinas_iguais") toast.error("Escolha oficinas diferentes.");
    else toast.error("Falha: " + (status ?? "desconhecida"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="card-elevated w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Editar inscrição</h3>
          <button onClick={onFechar} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          Protocolo <span className="font-mono">{inscricao.protocolo}</span> · CPF {formatarCpf(inscricao.cpf)}
        </p>

        <label className="block text-sm font-medium">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <label className="mt-4 block text-sm font-medium">Oficina de quinta-feira</label>
        <select
          value={quintaId}
          onChange={(e) => setQuintaId(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        >
          {quintas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.titulo} — {o.inscritos}/{o.limite_vagas}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium">Oficina de sexta-feira</label>
        <select
          value={sextaId}
          onChange={(e) => setSextaId(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        >
          {sextas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.titulo} — {o.inscritos}/{o.limite_vagas}
            </option>
          ))}
        </select>

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

function ModalEditarOficina({
  oficina,
  onFechar,
  onSalvo,
}: {
  oficina: OficinaComVagas;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [titulo, setTitulo] = useState(oficina.titulo);
  const [ministrante, setMinistrante] = useState(oficina.ministrante);
  const [publicoAlvo, setPublicoAlvo] = useState(oficina.publico_alvo ?? "");
  const [dia, setDia] = useState<"quinta" | "sexta">(oficina.dia);
  const [data, setData] = useState(oficina.data);
  const [limite, setLimite] = useState(oficina.limite_vagas);
  const [ordem, setOrdem] = useState(oficina.ordem);
  const [ativa, setAtiva] = useState(oficina.ativa);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (titulo.trim().length < 3) {
      toast.error("Informe um título válido.");
      return;
    }
    if (ministrante.trim().length < 2) {
      toast.error("Informe o ministrante.");
      return;
    }
    if (limite < oficina.inscritos) {
      toast.error(`O limite não pode ser menor que ${oficina.inscritos} (já inscritos).`);
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("oficinas")
      .update({
        titulo: titulo.trim(),
        ministrante: ministrante.trim(),
        publico_alvo: publicoAlvo.trim() || null,
        dia,
        data,
        limite_vagas: limite,
        ordem,
        ativa,
      })
      .eq("id", oficina.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar a oficina.");
      return;
    }
    toast.success("Oficina atualizada.");
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="card-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Editar oficina</h3>
          <button onClick={onFechar} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm font-medium">Título</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <label className="mt-4 block text-sm font-medium">Ministrante</label>
        <input
          value={ministrante}
          onChange={(e) => setMinistrante(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <label className="mt-4 block text-sm font-medium">Público-alvo</label>
        <input
          value={publicoAlvo}
          onChange={(e) => setPublicoAlvo(e.target.value)}
          placeholder="Ex.: Geral, Educação Infantil..."
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Dia</label>
            <select
              value={dia}
              onChange={(e) => setDia(e.target.value as "quinta" | "sexta")}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            >
              <option value="quinta">Quinta-feira</option>
              <option value="sexta">Sexta-feira</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">
              Limite de vagas <span className="text-xs text-muted-foreground">(mín. {oficina.inscritos})</span>
            </label>
            <input
              type="number"
              min={oficina.inscritos}
              value={limite}
              onChange={(e) => setLimite(parseInt(e.target.value, 10) || 0)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(parseInt(e.target.value, 10) || 0)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-4 w-4" />
          <span>Oficina ativa (visível para inscrição)</span>
        </label>

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
