import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listarParticipantesPublico, type ParticipantePublico } from "@/lib/oficinas";

export const Route = createFileRoute("/participantes")({
  head: () => ({
    meta: [
      { title: "Participantes por oficina — SME" },
      { name: "description", content: "Lista pública de participantes inscritos em cada oficina." },
    ],
  }),
  component: ParticipantesPage,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar a lista.</div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada.</div>,
});

type ParticipanteItem = { nome: string; manha: boolean; tarde: boolean; horas: number };

type OficinaAgrupada = {
  oficina_id: string;
  dia: "quinta" | "sexta";
  data: string;
  titulo: string;
  ministrante: string;
  publico_alvo: string | null;
  ordem: number;
  participantes: ParticipanteItem[];
};

function agrupar(rows: ParticipantePublico[]): OficinaAgrupada[] {
  const map = new Map<string, OficinaAgrupada>();
  for (const r of rows) {
    let g = map.get(r.oficina_id);
    if (!g) {
      g = {
        oficina_id: r.oficina_id,
        dia: r.dia,
        data: r.data,
        titulo: r.titulo,
        ministrante: r.ministrante,
        publico_alvo: r.publico_alvo,
        ordem: r.ordem,
        participantes: [],
      };
      map.set(r.oficina_id, g);
    }
    if (r.nome) g.participantes.push({ nome: r.nome, manha: r.manha, tarde: r.tarde, horas: r.horas });
  }
  return Array.from(map.values()).sort(
    (a, b) => (a.dia === b.dia ? a.ordem - b.ordem : a.dia === "quinta" ? -1 : 1),
  );
}

function ParticipantesPage() {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["participantes-publicos"],
    queryFn: listarParticipantesPublico,
    refetchOnWindowFocus: true,
  });

  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("inscricoes-publico")
      .on("postgres_changes", { event: "*", schema: "public", table: "inscricoes" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const grupos = useMemo(() => agrupar(data), [data]);
  const quinta = grupos.filter((g) => g.dia === "quinta");
  const sexta = grupos.filter((g) => g.dia === "sexta");

  function irPara(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggle(oficinaId: string) {
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(oficinaId)) next.delete(oficinaId);
      else next.add(oficinaId);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => irPara("dia-quinta")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <Calendar className="h-3.5 w-3.5 text-primary" /> Quinta
              </button>
              <button
                type="button"
                onClick={() => irPara("dia-sexta")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <Calendar className="h-3.5 w-3.5 text-primary" /> Sexta
              </button>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" /> Participantes
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-16">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {!isLoading && (
          <>
            <div id="dia-quinta" className="scroll-mt-24">
              <SecaoDia titulo="Quinta-feira, 23/07" grupos={quinta} abertas={abertas} onToggle={toggle} />
            </div>

            <div id="dia-sexta" className="scroll-mt-24">
              <SecaoDia titulo="Sexta-feira, 24/07" grupos={sexta} abertas={abertas} onToggle={toggle} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}


function SecaoDia({
  titulo,
  grupos,
  abertas,
  onToggle,
}: {
  titulo: string;
  grupos: OficinaAgrupada[];
  abertas: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
        <Calendar className="h-4 w-4 text-primary" /> {titulo}
      </h2>
      <div className="space-y-3">
        {grupos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma oficina disponível.
          </p>
        )}
        {grupos.map((g) => {
          const aberta = abertas.has(g.oficina_id);
          return (
            <article key={g.oficina_id} className="card-elevated overflow-hidden">
              <button
                type="button"
                onClick={() => onToggle(g.oficina_id)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left transition hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{g.titulo}</h3>
                  <p className="text-xs text-muted-foreground">Ministrante: {g.ministrante}</p>
                  {g.publico_alvo && (
                    <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {g.publico_alvo}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                    {g.nomes.length} {g.nomes.length === 1 ? "inscrito" : "inscritos"}
                  </span>
                  {aberta ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {aberta && (
                <div className="border-t border-border px-5 pb-5">
                  {g.nomes.length === 0 ? (
                    <p className="pt-4 text-sm text-muted-foreground">Nenhum participante inscrito ainda.</p>
                  ) : (
                    <ol className="grid gap-1 pt-4 text-sm text-foreground sm:grid-cols-2">
                      {g.nomes.map((nome, i) => (
                        <li key={i} className="flex gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          <span className="truncate">{nome}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
