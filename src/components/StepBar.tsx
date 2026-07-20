type Props = { atual: number; total: number; labels?: string[] };

export function StepBar({ atual, total, labels }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1;
          const done = idx < atual;
          const active = idx === atual;
          return (
            <div key={i} className="flex-1">
              <div
                className={[
                  "h-2 rounded-full transition-all",
                  done
                    ? "brand-gradient"
                    : active
                      ? "brand-gradient"
                      : "bg-muted",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>
          Etapa {atual} de {total}
        </span>
        {labels && labels[atual - 1] && <span className="font-medium">{labels[atual - 1]}</span>}
      </div>
    </div>
  );
}
