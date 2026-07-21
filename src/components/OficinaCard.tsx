import { CheckCircle2, Users, UserCog, Lock } from "lucide-react";
import type { OficinaComVagas } from "@/lib/oficinas";

type Props = {
  oficina: OficinaComVagas;
  selecionada: boolean;
  desabilitada?: boolean;
  motivoDesabilitada?: string;
  onSelecionar: () => void;
};

export function OficinaCard({ oficina, selecionada, desabilitada, motivoDesabilitada, onSelecionar }: Props) {
  const limiteVagas = Math.max(0, Number(oficina.limite_vagas ?? 0));
  const inscritos = Math.max(0, Number(oficina.inscritos ?? 0));
  const vagasDisponiveis = Math.max(0, limiteVagas - inscritos);
  const lotada = oficina.lotada || vagasDisponiveis <= 0 || inscritos >= limiteVagas;
  const bloqueada = desabilitada || lotada;

  const ocupacaoCor = lotada
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : vagasDisponiveis <= 5
      ? "border-warning/40 bg-warning/20 text-warning-foreground"
      : "border-success/30 bg-success/10 text-success";

  return (
    <button
      type="button"
      onClick={bloqueada ? undefined : onSelecionar}
      disabled={bloqueada}
      aria-pressed={selecionada}
      className={[
        "group relative w-full text-left rounded-2xl border p-5 transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selecionada
          ? "border-primary bg-accent shadow-[0_0_0_3px_var(--color-primary)/15] ring-2 ring-primary"
          : bloqueada
            ? "border-border bg-muted/40 opacity-70 cursor-not-allowed"
            : "border-border bg-card hover:border-primary/60 hover:shadow-card-hover",
      ].join(" ")}
    >
      {selecionada && (
        <div className="absolute right-4 top-4 rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      )}

      <h3 className="pr-8 text-lg font-semibold leading-snug text-foreground">
        {oficina.titulo}
      </h3>

      {oficina.publico_alvo && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm leading-snug">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
              Público-alvo
            </span>
            <span className="font-semibold text-foreground">{oficina.publico_alvo}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <UserCog className="h-4 w-4 shrink-0" />
        <span>
          <span className="text-foreground/80 font-medium">Ministrante:</span>{" "}
          {oficina.ministrante}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${ocupacaoCor}`}>
          <span>{inscritos}/{limiteVagas}</span>
          <span className="text-xs font-black uppercase">
            {lotada ? "Esgotado" : `${vagasDisponiveis} vaga${vagasDisponiveis === 1 ? "" : "s"}`}
          </span>
        </div>
        {desabilitada && !lotada && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {motivoDesabilitada}
          </span>
        )}
      </div>

      {desabilitada && !lotada && motivoDesabilitada && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {motivoDesabilitada}
        </p>
      )}
    </button>
  );
}
