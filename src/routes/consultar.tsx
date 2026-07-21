import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, CheckCircle2, Printer, GraduationCap } from "lucide-react";
import { consultarInscricaoPorCpf, type ConsultaResultado } from "@/lib/oficinas";
import { cpfValido, formatarCpf, normalizarCpf } from "@/lib/format";
import { TelaManutencao, useManutencao } from "@/components/Manutencao";

export const Route = createFileRoute("/consultar")({
  component: ConsultarPage,
});

function ConsultarPage() {
  const [cpf, setCpf] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null);

  async function buscar() {
    if (!cpfValido(cpf)) {
      toast.error("CPF inválido. Verifique os números digitados.");
      return;
    }
    setBuscando(true);
    setResultado(null);
    try {
      const r = await consultarInscricaoPorCpf(cpf);
      setResultado(r);
      if (r.status === "nao_encontrado") {
        toast.error("Nenhuma inscrição encontrada para este CPF.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível consultar. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SME · Estudo e Planejamento</p>
              <h1 className="text-base font-semibold text-foreground">Consultar Inscrição</h1>
            </div>
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="inline h-3 w-3" /> Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="card-elevated p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Consultar minha inscrição</h2>
          <p className="mt-1 text-sm text-muted-foreground">Digite seu CPF para ver as oficinas em que você está inscrito.</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input
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
              onChange={(e) => { setCpf(normalizarCpf(e.target.value)); setResultado(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
              className="h-16 w-full flex-1 rounded-xl border border-input bg-background px-5 text-2xl font-medium tracking-wider outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              onClick={buscar}
              disabled={buscando || normalizarCpf(cpf).length !== 11}
              className="brand-gradient inline-flex h-16 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Consultar
            </button>
          </div>
        </section>

        {resultado?.status === "encontrado" && (
          <section className="card-elevated mt-6 p-6 sm:p-8 print:shadow-none print:border-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-sm">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Inscrição confirmada</h3>
                <p className="text-sm text-muted-foreground">Guarde seu comprovante abaixo.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-foreground">{resultado.protocolo}</p>

              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Participante</dt>
                  <dd className="font-semibold text-foreground">{resultado.nome}</dd>
                  <dd className="text-muted-foreground">{formatarCpf(cpf)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Quinta-feira, 23/07</dt>
                  <dd className="font-semibold text-foreground">{resultado.oficina_quinta.titulo}</dd>
                  <dd className="text-muted-foreground">Ministrante: {resultado.oficina_quinta.ministrante}</dd>
                  {resultado.oficina_quinta.publico_alvo && (
                    <dd className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {resultado.oficina_quinta.publico_alvo}
                    </dd>
                  )}
                  <PresencaLinha p={resultado.oficina_quinta} />
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Sexta-feira, 24/07</dt>
                  <dd className="font-semibold text-foreground">{resultado.oficina_sexta.titulo}</dd>
                  <dd className="text-muted-foreground">Ministrante: {resultado.oficina_sexta.ministrante}</dd>
                  {resultado.oficina_sexta.publico_alvo && (
                    <dd className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {resultado.oficina_sexta.publico_alvo}
                    </dd>
                  )}
                  <PresencaLinha p={resultado.oficina_sexta} />
                </div>
                <div className="border-t border-border pt-3">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">TOTAL DE HORAS CONCLUÍDAS</dt>
                  <dd className="text-lg font-bold text-primary">{resultado.total_horas}h</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
              >
                <Printer className="h-4 w-4" /> Salvar comprovante
              </button>
            </div>

          </section>
        )}

        {resultado?.status === "nao_encontrado" && (
          <section className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não encontramos nenhuma inscrição para este CPF.
            </p>
            <Link
              to="/"
              className="brand-gradient mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
            >
              Fazer minha inscrição
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function PresencaLinha({ p }: { p: { manha: boolean; tarde: boolean; horas: number } }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${p.manha ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}
      >
        Manhã: {p.manha ? "presente" : "ausente"}
      </span>
      <span
        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${p.tarde ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}
      >
        Tarde: {p.tarde ? "presente" : "ausente"}
      </span>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
        {p.horas}h
      </span>
    </div>
  );
}
