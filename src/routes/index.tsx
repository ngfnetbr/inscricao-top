import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, GraduationCap, Sparkles, Search, Users, Home } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  listarOficinas,
  buscarPessoaPorCpf,
  confirmarInscricao,
  consultarInscricaoPorCpf,
  type OficinaComVagas,
  type ConfirmarResultado,
} from "@/lib/oficinas";
import { cpfValido, formatarCpf, normalizarCpf } from "@/lib/format";
import { StepBar } from "@/components/StepBar";
import { OficinaCard } from "@/components/OficinaCard";
import { TelaManutencao, useManutencao } from "@/components/Manutencao";
import logoConversas from "@/assets/conversas-pedagogicas.png.asset.json";
import logoNgf from "@/assets/ngf-solucoes-em-tecnologia.png.asset.json";



export const Route = createFileRoute("/")({
  component: InscricaoPage,
});

type Etapa = 0 | 1 | 2 | 3 | 4 | 5;

type Sucesso = {
  nome: string;
  cpf: string;
  oficinaQuinta: OficinaComVagas;
  oficinaSexta: OficinaComVagas;
};

function InscricaoPage() {
  const { data: manutencao, isLoading: manutencaoLoading } = useManutencao();
  const [etapa, setEtapa] = useState<Etapa>(0);

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
    queryFn: () => listarOficinas(),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 15000,
    staleTime: 0,
  });

  // Sempre voltar ao topo ao mudar de etapa e revalidar vagas
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (etapa === 2 || etapa === 3 || etapa === 4) {
      refetch();
    }
  }, [etapa, refetch]);


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
      const jaInscrito = await consultarInscricaoPorCpf(cpf);
      if (jaInscrito.status === "encontrado") {
        toast.error("Este CPF já possui uma inscrição registrada. Use 'Consultar minha inscrição' para visualizá-la.");
        setStatusBusca("idle");
        setBuscando(false);
        return;
      }
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

  function voltarAoInicio() {
    setEtapa(0);
    setCpf("");
    setNome("");
    setPessoaEncontrada(null);
    setStatusBusca("idle");
    setOficinaQuintaId(null);
    setOficinaSextaId(null);
    setSucesso(null);
    setConfirmando(false);
  }

  if (manutencaoLoading) return <div className="min-h-screen bg-background" />;
  if (manutencao?.ativo) return <TelaManutencao mensagem={manutencao.mensagem} />;

  return (
    <div className="min-h-screen bg-background">



      <main className="mx-auto max-w-3xl px-3 py-4 pb-20 sm:px-4 sm:py-6 sm:pb-24">
        {etapa >= 1 && etapa < 5 && (
          <div className="mb-6 space-y-3">
            <StepBar atual={etapa} total={4} labels={labels.slice(0, 4)} />
            <button
              onClick={voltarAoInicio}
              className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" /> Voltar ao início
            </button>
          </div>
        )}

        {etapa === 0 && <EtapaLanding onInscrever={() => setEtapa(1)} />}


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
            onVoltarInicio={voltarAoInicio}
          />
        )}

        {etapa === 2 && (
          <EtapaOficinas
            badge="quinta-feira, 23/07"
            badgeTone="quinta"
            titulo="Escolha uma oficina para"
            oficinas={oficinasQuinta}
            selecionadaId={oficinaQuintaId}
            outraSelecionadaId={oficinaSextaId}
            outraOficina={oficinaSexta}
            onSelecionar={(id) => setOficinaQuintaId(id)}
            avancar={() => setEtapa(3)}
            voltar={() => setEtapa(1)}
          />
        )}

        {etapa === 3 && (
          <EtapaOficinas
            badge="sexta-feira, 24/07"
            badgeTone="sexta"
            titulo="Escolha uma oficina para"
            oficinas={oficinasSexta}
            selecionadaId={oficinaSextaId}
            outraSelecionadaId={oficinaQuintaId}
            outraOficina={oficinaQuinta}
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

        <footer className="mt-6 flex flex-col items-center justify-center gap-2 border-t border-border/60 pt-5 text-center sm:mt-8 sm:gap-3 sm:pt-6">
          <p className="text-xs font-medium text-muted-foreground">Desenvolvido por:</p>
          <img
            src={logoNgf.url}
            alt="NGF - Soluções em Tecnologia"
            className="h-9 w-auto object-contain opacity-90 sm:h-10"
          />
        </footer>
      </main>
    </div>

  );
}

/* ----------------------------- Etapa 0 - Landing ----------------------------- */

function EtapaLanding({ onInscrever }: { onInscrever: () => void }) {
  return (
    <section className="card-elevated p-4 text-center sm:p-10">
      <img
        src={logoConversas.url}
        alt="Conversas Pedagógicas — Rede Municipal de Educação de Nova Londrina"
        className="mx-auto mb-3 w-full max-w-[14rem] sm:mb-4 sm:max-w-[18rem]"
      />
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground sm:mt-2 sm:text-sm">
        Escolha uma oficina para cada dia (23 e 24 de julho) e garanta sua vaga.
      </p>

      <div className="mx-auto mt-5 flex max-w-md flex-col gap-2.5 sm:mt-8 sm:gap-3">
        <button
          onClick={onInscrever}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 sm:px-6 sm:py-4 sm:text-base"
        >
          <Sparkles className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" /> Inscreva-se agora
        </button>
        <Link
          to="/consultar"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted sm:px-6 sm:py-4 sm:text-base"
        >
          <Search className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" /> Consultar minha inscrição
        </Link>
        <Link
          to="/participantes"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted sm:px-6 sm:py-4 sm:text-base"
        >
          <Users className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" /> Ver participantes por oficina
        </Link>
      </div>

      <div className="mt-6 flex justify-center sm:mt-8">
        <Link
          to="/admin"
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          Área administrativa
        </Link>
      </div>
    </section>
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
  onVoltarInicio: () => void;
}) {
  const {
    cpf, setCpf, nome, setNome, statusBusca, setStatusBusca,
    pessoaEncontrada, buscarCpf, buscando, avancar, onVoltarInicio,
  } = props;
  const [avisoNaoSouEu, setAvisoNaoSouEu] = useState(false);

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
            name={`cpf-${Math.random().toString(36).slice(2)}`}
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
            placeholder="000.000.000-00"
            value={formatarCpf(cpf)}
            onChange={(e) => {
              setCpf(normalizarCpf(e.target.value));
              setAvisoNaoSouEu(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && statusBusca === "idle") {
                e.preventDefault();
                buscarCpf();
              }
            }}
            disabled={statusBusca === "encontrado" || statusBusca === "nao_encontrado" || statusBusca === "editando"}
            className="h-16 w-full flex-1 rounded-xl border border-input bg-background px-5 text-2xl font-medium tracking-wider outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:bg-muted"
          />
          {statusBusca === "idle" && (
            <button
              onClick={buscarCpf}
              disabled={buscando || normalizarCpf(cpf).length !== 11}
              className="brand-gradient inline-flex h-16 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="mt-4 text-sm font-medium text-foreground">O que deseja fazer?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              onClick={avancar}
              className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
            >
              <CheckCircle2 className="h-4 w-4" /> Sim, sou eu
            </button>
            <button
              onClick={() => {
                setAvisoNaoSouEu(false);
                setStatusBusca("editando");
                setNome(pessoaEncontrada.nome);
              }}
              className="rounded-xl border border-primary/40 bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Sou eu, mas meu nome está incorreto
            </button>
            <button
              onClick={() => setAvisoNaoSouEu(true)}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Meu CPF está correto, mas não sou eu
            </button>
            <button
              onClick={onVoltarInicio}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Home className="h-4 w-4" /> Digitei o CPF errado, voltar ao início
            </button>
          </div>

          {avisoNaoSouEu && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Não é possível continuar com este CPF</p>
              <p className="mt-1">
                O CPF informado já pertence a outra pessoa em nossa base. Verifique se digitou corretamente ou procure a organização do evento.
              </p>
              <button
                onClick={onVoltarInicio}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-300"
              >
                <Home className="h-3.5 w-3.5" /> Voltar ao início
              </button>
            </div>
          )}
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
            name={`nome-${Math.random().toString(36).slice(2)}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
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
  badge?: string;
  badgeTone?: "quinta" | "sexta";
  oficinas: OficinaComVagas[];
  selecionadaId: string | null;
  outraSelecionadaId: string | null;
  outraOficina?: OficinaComVagas | null;
  onSelecionar: (id: string) => void;
  voltar: () => void;
  avancar: () => void;
}) {
  const { titulo, badge, badgeTone, oficinas, selecionadaId, outraSelecionadaId, outraOficina, onSelecionar, voltar, avancar } = props;
  const outraSelecionada =
    oficinas.find((o) => o.id === outraSelecionadaId) ?? outraOficina ?? null;

  const badgeClasses =
    badgeTone === "sexta"
      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
      : "bg-sky-100 text-sky-900 ring-1 ring-sky-300";

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{titulo}</h2>
        {badge && (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Toque no cartão para selecionar uma oficina.</p>


      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {oficinas.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma oficina disponível no momento.
          </p>
        )}
        {oficinas.map((o) => {
          const jaEscolhida =
            !!outraSelecionada &&
            (outraSelecionada.id === o.id ||
              outraSelecionada.titulo.trim().toLowerCase() === o.titulo.trim().toLowerCase());
          return (
            <OficinaCard
              key={o.id}
              oficina={o}
              selecionada={selecionadaId === o.id}
              desabilitada={jaEscolhida}
              motivoDesabilitada={jaEscolhida ? "Você já escolheu esta oficina no outro dia." : undefined}
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
  return (
    <section className="card-elevated p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-sm">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inscrição realizada com sucesso!</h2>
          <p className="text-sm text-muted-foreground">Sua vaga foi garantida nas oficinas abaixo.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-5">
        <dl className="space-y-3 text-sm">
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

      <div className="mt-6 flex justify-end">
        <a
          href="/"
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
        >
          Finalizar
        </a>
      </div>
    </section>
  );
}
