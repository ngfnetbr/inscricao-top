import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Save, Search, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatarCpf } from "@/lib/format";
import { listarChamada, marcarPresenca, listarMinhasOficinas, type ChamadaItem, type MinhaOficina } from "@/lib/chamada";

export const Route = createFileRoute("/chamada/$oficinaId")({
  component: ChamadaOficina,
});

function ChamadaOficina() {
  const { oficinaId } = useParams({ from: "/chamada/$oficinaId" });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [oficina, setOficina] = useState<MinhaOficina | null>(null);
  const [itens, setItens] = useState<ChamadaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/chamada" });
        return;
      }
      setEmail(data.session.user.email ?? null);
    });
  }, [navigate]);

  async function carregar() {
    setCarregando(true);
    try {
      const [lista, minhas] = await Promise.all([listarChamada(oficinaId), listarMinhasOficinas()]);
      setItens(lista);
      setOficina(minhas.find((o) => o.id === oficinaId) ?? null);
    } catch {
      toast.error("Falha ao carregar chamada.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (email) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, oficinaId]);

  async function alterar(item: ChamadaItem, campo: "manha" | "tarde", valor: boolean | null) {
    const novo = { ...item, [campo]: valor };
    novo.horas = (novo.manha === true ? 4 : 0) + (novo.tarde === true ? 4 : 0);
    setItens((prev) => prev.map((i) => (i.inscricao_id === item.inscricao_id ? novo : i)));
    setSalvando(item.inscricao_id);
    const rotulo = campo === "manha" ? "manhã" : "tarde";
    const loadingId = toast.loading(`Salvando ${rotulo} — ${item.nome}...`);
    try {
      const res = await marcarPresenca({
        inscricaoId: item.inscricao_id,
        oficinaId,
        manha: novo.manha,
        tarde: novo.tarde,
      });
      if (res.status !== "sucesso") throw new Error(res.status);
      const acao = valor === true ? "presente" : valor === false ? "falta" : "sem marcação";
      toast.success(`${item.nome}: ${rotulo} — ${acao}.`, { id: loadingId });
    } catch (e) {
      console.error(e);
      toast.error(`Não foi possível salvar a presença de ${item.nome}.`, { id: loadingId });
      setItens((prev) => prev.map((i) => (i.inscricao_id === item.inscricao_id ? item : i)));
    } finally {
      setSalvando(null);
    }
  }

  const itensFiltrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter(
      (i) => i.nome.toLowerCase().includes(f) || i.cpf.includes(f.replace(/\D/g, "")),
    );
  }, [filtro, itens]);

  const totais = useMemo(() => {
    let presentes = 0, faltas = 0, pendentes = 0, concluidos = 0;
    for (const i of itens) {
      if (i.manha === true || i.tarde === true) presentes++;
      if (i.manha === false || i.tarde === false) faltas++;
      if (i.manha === null && i.tarde === null) pendentes++;
      if (i.manha === true && i.tarde === true) concluidos++;
    }
    return { presentes, faltas, pendentes, concluidos };
  }, [itens]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="min-w-0">
            <Link to="/chamada" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Minhas oficinas
            </Link>
            <h1 className="mt-1 truncate text-base font-semibold text-foreground">
              {oficina?.titulo ?? "Chamada"}
            </h1>
            {oficina && (
              <p className="text-xs text-muted-foreground">
                {oficina.ministrante} · {oficina.dia === "quinta" ? "Quinta 23/07" : "Sexta 24/07"}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox label="Presenças" valor={totais.presentes} tone="success" />
          <StatBox label="Faltas" valor={totais.faltas} tone="danger" />
          <StatBox label="Pendentes" valor={totais.pendentes} />
          <StatBox label="8h (ambos)" valor={totais.concluidos} tone="success" />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : itensFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum inscrito encontrado.</p>
        ) : (
          <ul className="card-elevated divide-y divide-border overflow-hidden">
            {itensFiltrados.map((i) => (
              <li key={i.inscricao_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatarCpf(i.cpf)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TurnoControle
                    label="Manhã"
                    valor={i.manha}
                    disabled={salvando === i.inscricao_id}
                    onChange={(v) => alterar(i, "manha", v)}
                  />
                  <TurnoControle
                    label="Tarde"
                    valor={i.tarde}
                    disabled={salvando === i.inscricao_id}
                    onChange={(v) => alterar(i, "tarde", v)}
                  />
                  <span
                    className={[
                      "min-w-[3.5rem] rounded-full px-2 py-1 text-center text-xs font-semibold",
                      i.horas === 8
                        ? "bg-success/15 text-success"
                        : i.horas === 4
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {i.horas}h
                  </span>
                  {salvando === i.inscricao_id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Save className="h-3.5 w-3.5" />
          As presenças e faltas são salvas automaticamente ao marcar. Clique novamente para limpar.
        </p>
      </main>
    </div>
  );
}

function StatBox({ label, valor, tone }: { label: string; valor: number; tone?: "success" | "danger" }) {
  const cor =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="card-elevated p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

function TurnoControle({
  label,
  valor,
  disabled,
  onChange,
}: {
  label: string;
  valor: boolean | null;
  disabled?: boolean;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(valor === true ? null : true)}
          aria-pressed={valor === true}
          title={valor === true ? "Desmarcar presença" : "Marcar presente"}
          className={[
            "inline-flex h-8 w-9 items-center justify-center text-xs font-semibold transition",
            valor === true
              ? "bg-success text-success-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
            disabled ? "opacity-60" : "",
          ].join(" ")}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(valor === false ? null : false)}
          aria-pressed={valor === false}
          title={valor === false ? "Desmarcar falta" : "Marcar falta"}
          className={[
            "inline-flex h-8 w-9 items-center justify-center border-l border-border text-xs font-semibold transition",
            valor === false
              ? "bg-destructive text-destructive-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
            disabled ? "opacity-60" : "",
          ].join(" ")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
