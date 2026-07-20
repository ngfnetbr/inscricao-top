import { CheckCircle2, Users, UserCog, Lock } from "lucide-react";
import type { OficinaComVagas } from "@/lib/oficinas";
import { textoVagas } from "@/lib/format";

type Props = {
  oficina: OficinaComVagas;
  selecionada: boolean;
  desabilitada?: boolean;
  motivoDesabilitada?: string;
  onSelecionar: () => void;
};

export function OficinaCard({ oficina, selecionada, desabilitada, motivoDesabilitada, onSelecionar }: Props) {
  const lotada = oficina.lotada || oficina.vagas_disponiveis <= 0;
  const bloqueada = desabilitada || lotada;

  const vagasTexto = lotada
    ? "Oficina lotada"
    : textoVagas(oficina.vagas_disponiveis, false);

  const vagasCor = lotada
    ? "text-destructive"
    : oficina.vagas_disponiveis === 1
      ? "text-warning-foreground bg-warning/25 px-2 py-0.5 rounded-full"
      : oficina.vagas_disponiveis <= 5
        ? "text-warning-foreground bg-warning/20 px-2 py-0.5 rounded-full"
        : "text-success";

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

      <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 shrink-0" />
          <span>
            <span className="text-foreground/80 font-medium">Ministrante:</span>{" "}
            {oficina.ministrante}
          </span>
        </div>
        {oficina.publico_alvo && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              <span className="text-foreground/80 font-medium">Público:</span>{" "}
              {oficina.publico_alvo}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`text-sm font-semibold ${vagasCor}`}>{vagasTexto}</span>
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
