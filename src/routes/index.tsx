import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, GraduationCap, Sparkles, Search, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  listarOficinas,
  buscarPessoaPorCpf,
  confirmarInscricao,
  type OficinaComVagas,
  type ConfirmarResultado,
} from "@/lib/oficinas";
import { cpfValido, formatarCpf, normalizarCpf } from "@/lib/format";
import { StepBar } from "@/components/StepBar";
import { OficinaCard } from "@/components/OficinaCard";

export const Route = createFileRoute("/")({
  component: InscricaoPage,
});

type Etapa = 1 | 2 | 3 | 4 | 5;

type Sucesso = {
  protocolo: string;
  nome: string;
  cpf: string;
  oficinaQuinta: OficinaComVagas;
  oficinaSexta: OficinaComVagas;
};

function InscricaoPage() {
  const [etapa, setEtapa] = useState<Etapa>(1);

  // Etapa 1
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [pessoaEncontrada, setPessoaEncontrada] = useState<{ id: string; nome: string } | null>(null);
  const [statusBusca, setStatusBusca] = useState<"idle" | "buscando" | "encontrado" | "nao_encontrado" | "editando">("idle");
  const [buscando, setBuscando] = useState(false);

  // Etapa 2/3
  const [oficinaQuintaId, setOficinaQuintaId] = useState<string | null>(null);
  const [oficinaSextaId, setOficinaSextaId] = useState<string | null>(null);

  // Etapa 4
  const [confirmando, setConfirmando] = useState(false);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);

  const { data: oficinas = [], refetch } = useQuery({
    queryKey: ["oficinas"],
    queryFn: listarOficinas,
    refetchOnWindowFocus: true,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("inscricoes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inscricoes" },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const oficinasQuinta = useMemo(() => oficinas.filter((o) => o.dia === "quinta"), [oficinas]);
  const oficinasSexta = useMemo(() => oficinas.filter((o) => o.dia === "sexta"), [oficinas]);

  const oficinaQuinta = oficinas.find((o) => o.id === oficinaQuintaId) ?? null;
  const oficinaSexta = oficinas.find((o) => o.id === oficinaSextaId) ?? null;

  const labels = ["Identificação", "Quinta-feira", "Sexta-feira", "Revisão", "Confirmação"];

  async function buscarCpf() {
    if (!cpfValido(cpf)) {
      toast.error("CPF inválido. Verifique os números digitados.");
      return;
    }
    setBuscando(true);
    setStatusBusca("buscando");
    try {
      const p = await buscarPessoaPorCpf(cpf);
      if (p) {
        setPessoaEncontrada(p);
        setNome(p.nome);
        setStatusBusca("encontrado");
      } else {
        setPessoaEncontrada(null);
        setNome("");
        setStatusBusca("nao_encontrado");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível consultar o CPF. Tente novamente.");
      setStatusBusca("idle");
    } finally {
      setBuscando(false);
    }
  }

  function irParaEtapa2() {
    if (!nome.trim() || nome.trim().length < 3) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setEtapa(2);
  }

  async function confirmar() {
    if (!oficinaQuinta || !oficinaSexta) return;
    setConfirmando(true);
    await refetch();
    try {
      const r = (await confirmarInscricao({
        cpf,
        nome: nome.trim(),
        oficinaQuintaId: oficinaQuinta.id,
        oficinaSextaId: oficinaSexta.id,
      })) as ConfirmarResultado;

      if (r.status === "sucesso") {
        setSucesso({
          protocolo: r.protocolo,
          nome: r.nome,
          cpf,
          oficinaQuinta,
          oficinaSexta,
        });
        setEtapa(5);
        return;
      }

      // Tratar erros
      if (r.status === "oficina_quinta_lotada") {
        toast.error("A oficina de quinta-feira acabou de atingir o limite. Escolha outra opção para continuar.");
        setOficinaQuintaId(null);
        setEtapa(2);
      } else if (r.status === "oficina_sexta_lotada") {
        toast.error("A oficina de sexta-feira acabou de atingir o limite. Escolha outra opção para continuar.");
        setOficinaSextaId(null);
        setEtapa(3);
      } else if (r.status === "cpf_ja_inscrito") {
        toast.error("Este CPF já possui uma inscrição registrada.");
      } else if (r.status === "oficinas_iguais") {
        toast.error("Escolha oficinas diferentes para cada dia.");
        setEtapa(3);
      } else if (r.status === "oficina_invalida") {
        toast.error("Oficina indisponível. Escolha novamente.");
        setEtapa(2);
      } else {
        toast.error("Não foi possível confirmar. Verifique os dados e tente novamente.");
      }
      setConfirmando(false);
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao confirmar a inscrição. Tente novamente.");
      setConfirmando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SME · Estudo e Planejamento</p>
              <h1 className="text-base font-semibold text-foreground">Inscrição nas Oficinas</h1>
            </div>
          </div>
          <Link
            to="/admin"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Área administrativa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
        {etapa < 5 && (
          <div className="mb-6">
            <StepBar atual={etapa} total={4} labels={labels.slice(0, 4)} />
          </div>
        )}

        {etapa === 1 && (
          <Etapa1
            cpf={cpf}
            setCpf={(v) => {
              setCpf(v);
              setStatusBusca("idle");
              setPessoaEncontrada(null);
            }}
            nome={nome}
            setNome={setNome}
            statusBusca={statusBusca}
            setStatusBusca={setStatusBusca}
            pessoaEncontrada={pessoaEncontrada}
            buscarCpf={buscarCpf}
            buscando={buscando}
            avancar={irParaEtapa2}
          />
        )}

        {etapa === 2 && (
          <EtapaOficinas
            titulo="Escolha uma oficina para quinta-feira, 23/07."
            oficinas={oficinasQuinta}
            selecionadaId={oficinaQuintaId}
            outraSelecionadaId={oficinaSextaId}
            onSelecionar={(id) => setOficinaQuintaId(id)}
            avancar={() => setEtapa(3)}
            voltar={() => setEtapa(1)}
          />
        )}

        {etapa === 3 && (
          <EtapaOficinas
            titulo="Escolha uma oficina para sexta-feira, 24/07."
            oficinas={oficinasSexta}
            selecionadaId={oficinaSextaId}
            outraSelecionadaId={oficinaQuintaId}
            onSelecionar={(id) => setOficinaSextaId(id)}
            avancar={() => setEtapa(4)}
            voltar={() => setEtapa(2)}
          />
        )}

        {etapa === 4 && oficinaQuinta && oficinaSexta && (
          <EtapaRevisao
            nome={nome}
            cpf={cpf}
            oficinaQuinta={oficinaQuinta}
            oficinaSexta={oficinaSexta}
            voltar={() => setEtapa(3)}
            confirmar={confirmar}
            confirmando={confirmando}
          />
        )}

        {etapa === 5 && sucesso && <EtapaSucesso dados={sucesso} />}
      </main>
    </div>
  );
}

/* ----------------------------- Etapa 1 ----------------------------- */

function Etapa1(props: {
  cpf: string;
  setCpf: (v: string) => void;
  nome: string;
  setNome: (v: string) => void;
  statusBusca: "idle" | "buscando" | "encontrado" | "nao_encontrado" | "editando";
  setStatusBusca: (s: "idle" | "buscando" | "encontrado" | "nao_encontrado" | "editando") => void;
  pessoaEncontrada: { id: string; nome: string } | null;
  buscarCpf: () => void;
  buscando: boolean;
  avancar: () => void;
}) {
  const {
    cpf, setCpf, nome, setNome, statusBusca, setStatusBusca,
    pessoaEncontrada, buscarCpf, buscando, avancar,
  } = props;

  return (
    <section className="card-elevated p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Comece por aqui
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Inscrição nas Oficinas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Digite seu CPF para começar.</p>

      <div className="mt-6">
        <label htmlFor="cpf" className="mb-2 block text-sm font-medium text-foreground">CPF</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={formatarCpf(cpf)}
            onChange={(e) => setCpf(normalizarCpf(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && statusBusca === "idle") {
                e.preventDefault();
                buscarCpf();
              }
            }}
            disabled={statusBusca === "encontrado" || statusBusca === "nao_encontrado" || statusBusca === "editando"}
            className="h-14 flex-1 rounded-xl border border-input bg-background px-4 text-lg tracking-wide outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:bg-muted"
          />
          {statusBusca === "idle" && (
            <button
              onClick={buscarCpf}
              disabled={buscando || normalizarCpf(cpf).length !== 11}
              className="brand-gradient inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Continuar
            </button>
          )}
        </div>
      </div>

      {statusBusca === "encontrado" && pessoaEncontrada && (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-accent/60 p-5">
          <p className="text-sm text-muted-foreground">Encontramos este cadastro:</p>
          <p className="mt-1 text-xl font-bold text-foreground">{pessoaEncontrada.nome}</p>
          <p className="mt-3 text-sm font-medium text-foreground">É você?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={avancar}
              className="brand-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
            >
              <CheckCircle2 className="h-4 w-4" /> Sim, sou eu
            </button>
            <button
              onClick={() => {
                setStatusBusca("editando");
                setNome("");
              }}
              className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Não sou eu
            </button>
          </div>
        </div>
      )}

      {(statusBusca === "nao_encontrado" || statusBusca === "editando") && (
        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
          {statusBusca === "nao_encontrado" ? (
            <p className="text-sm text-muted-foreground">
              Não encontramos seu CPF em nossa base. Digite seu nome completo para continuar.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Digite seu nome completo.
            </p>
          )}
          <label htmlFor="nome" className="mt-4 mb-2 block text-sm font-medium text-foreground">
            Nome completo
          </label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={avancar}
              disabled={nome.trim().length < 3}
              className="brand-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Etapa Oficinas ----------------------------- */

function EtapaOficinas(props: {
  titulo: string;
  oficinas: OficinaComVagas[];
  selecionadaId: string | null;
  outraSelecionadaId: string | null;
  onSelecionar: (id: string) => void;
  voltar: () => void;
  avancar: () => void;
}) {
  const { titulo, oficinas, selecionadaId, outraSelecionadaId, onSelecionar, voltar, avancar } = props;

  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Toque no cartão para selecionar uma oficina.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {oficinas.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma oficina disponível no momento.
          </p>
        )}
        {oficinas.map((o) => {
          const jaEscolhida = outraSelecionadaId === o.id;
          return (
            <OficinaCard
              key={o.id}
              oficina={o}
              selecionada={selecionadaId === o.id}
              desabilitada={jaEscolhida}
              motivoDesabilitada={jaEscolhida ? "Você já escolheu esta oficina na quinta-feira." : undefined}
              onSelecionar={() => onSelecionar(o.id)}
            />
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          onClick={voltar}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <button
          onClick={avancar}
          disabled={!selecionadaId}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* ----------------------------- Etapa 4 - Revisão ----------------------------- */

function EtapaRevisao(props: {
  nome: string;
  cpf: string;
  oficinaQuinta: OficinaComVagas;
  oficinaSexta: OficinaComVagas;
  voltar: () => void;
  confirmar: () => void;
  confirmando: boolean;
}) {
  const { nome, cpf, oficinaQuinta, oficinaSexta, voltar, confirmar, confirmando } = props;
  return (
    <section className="card-elevated p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Confira suas escolhas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Revise os dados antes de confirmar sua inscrição.</p>

      <dl className="mt-6 divide-y divide-border rounded-2xl border border-border">
        <RevisaoLinha rotulo="Nome" valor={nome} />
        <RevisaoLinha rotulo="CPF" valor={formatarCpf(cpf)} />
        <RevisaoLinha rotulo="Quinta-feira, 23/07" valor={oficinaQuinta.titulo} sub={`Ministrante: ${oficinaQuinta.ministrante}`} />
        <RevisaoLinha rotulo="Sexta-feira, 24/07" valor={oficinaSexta.titulo} sub={`Ministrante: ${oficinaSexta.ministrante}`} />
      </dl>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          onClick={voltar}
          disabled={confirmando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar e alterar
        </button>
        <button
          onClick={confirmar}
          disabled={confirmando}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-80"
        >
          {confirmando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Confirmando suas vagas...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Confirmar inscrição
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function RevisaoLinha({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-48">{rotulo}</dt>
      <dd className="flex-1 text-sm sm:text-right">
        <span className="block font-semibold text-foreground">{valor}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}

/* ----------------------------- Etapa 5 - Sucesso ----------------------------- */

function EtapaSucesso({ dados }: { dados: Sucesso }) {
  function imprimir() {
    window.print();
  }
  return (
    <section className="card-elevated p-6 sm:p-8 print:shadow-none print:border-0">
      <div className="mb-4 flex items-center gap-3">
        <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-sm">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inscrição realizada com sucesso!</h2>
          <p className="text-sm text-muted-foreground">Guarde seu comprovante abaixo.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-foreground">{dados.protocolo}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Participante</dt>
            <dd className="font-semibold text-foreground">{dados.nome}</dd>
            <dd className="text-muted-foreground">{formatarCpf(dados.cpf)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Quinta-feira, 23/07</dt>
            <dd className="font-semibold text-foreground">{dados.oficinaQuinta.titulo}</dd>
            <dd className="text-muted-foreground">Ministrante: {dados.oficinaQuinta.ministrante}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Sexta-feira, 24/07</dt>
            <dd className="font-semibold text-foreground">{dados.oficinaSexta.titulo}</dd>
            <dd className="text-muted-foreground">Ministrante: {dados.oficinaSexta.ministrante}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between print:hidden">
        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
        >
          Finalizar
        </a>
        <button
          onClick={imprimir}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
        >
          <Printer className="h-4 w-4" /> Salvar comprovante
        </button>
      </div>
    </section>
  );
}
