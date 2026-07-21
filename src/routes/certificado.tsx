import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { consultarInscricaoPorCpf, type ConsultaResultado } from "@/lib/oficinas";
import { cpfValido, formatarCpf, normalizarCpf } from "@/lib/format";
import { abreviarNome } from "@/lib/nome";
import certificadoBase from "@/assets/certificado-base.png.asset.json";

type SearchParams = { cpf?: string };

export const Route = createFileRoute("/certificado")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    cpf: typeof s.cpf === "string" ? s.cpf : undefined,
  }),
  component: CertificadoPage,
});

function CertificadoPage() {
  const { cpf: cpfSearch } = Route.useSearch();
  const [cpf, setCpf] = useState(cpfSearch ?? "");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null);

  async function buscar(valor: string) {
    if (!cpfValido(valor)) {
      toast.error("CPF inválido.");
      return;
    }
    setBuscando(true);
    setResultado(null);
    try {
      const r = await consultarInscricaoPorCpf(valor);
      setResultado(r);
      if (r.status === "nao_encontrado") toast.error("Nenhuma inscrição encontrada.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao consultar.");
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    if (cpfSearch && cpfValido(cpfSearch)) {
      setCpf(cpfSearch);
      buscar(cpfSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpfSearch]);

  const oficinasComHoras = useMemo(() => {
    if (resultado?.status !== "encontrado") return [];
    return [resultado.oficina_quinta, resultado.oficina_sexta].filter((o) => o.horas > 0);
  }, [resultado]);

  const totalHoras = oficinasComHoras.reduce((s, o) => s + o.horas, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-semibold">Conversas Pedagógicas</Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="inline h-3 w-3" /> Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 print:p-0 print:max-w-none">
        <section className="card-elevated p-6 print:hidden">
          <h1 className="text-2xl font-bold">Certificado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite seu CPF para gerar o certificado. Só entram no certificado as oficinas com presença registrada.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formatarCpf(cpf)}
              onChange={(e) => setCpf(normalizarCpf(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(cpf); } }}
              className="h-12 flex-1 rounded-xl border border-input bg-background px-4 text-lg outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              onClick={() => buscar(cpf)}
              disabled={buscando || normalizarCpf(cpf).length !== 11}
              className="brand-gradient inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Gerar certificado
            </button>
          </div>
        </section>

        {resultado?.status === "encontrado" && oficinasComHoras.length === 0 && (
          <div className="card-elevated mt-6 p-6 text-center print:hidden">
            <p className="text-sm text-muted-foreground">
              Ainda não há presença registrada nas oficinas. O certificado será gerado após a chamada.
            </p>
          </div>
        )}

        {resultado?.status === "encontrado" && oficinasComHoras.length > 0 && (
          <>
            <div className="mt-6 flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
              </button>
            </div>

            <div className="mt-4 flex justify-center print:mt-0">
              <Certificado
                nome={resultado.nome}
                cpf={cpf}
                oficinas={oficinasComHoras.map((o) => ({ titulo: o.titulo, horas: o.horas }))}
                totalHoras={totalHoras}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Certificado({
  nome,
  cpf,
  oficinas,
  totalHoras,
}: {
  nome: string;
  cpf: string;
  oficinas: { titulo: string; horas: number }[];
  totalHoras: number;
}) {
  const nomeExibicao = abreviarNome(nome, 28);
  const umaOficina = oficinas.length === 1;

  return (
    <div className="certificado-page">
      <img src={certificadoBase.url} alt="" className="cert-bg" />
      <div className="cert-overlay">
        <p className="cert-intro">Certificamos que</p>
        <p className="cert-nome">{nomeExibicao},</p>
        <p className="cert-cpf">inscrito(a) no CPF {formatarCpf(cpf)}</p>

        <p className="cert-body">
          participou {umaOficina ? "da oficina:" : "das oficinas:"}
        </p>
        <ul className="cert-lista">
          {oficinas.map((o, i) => (
            <li key={i}>
              <strong>{o.titulo}</strong> — {o.horas} horas
            </li>
          ))}
        </ul>
        <p className="cert-total">
          totalizando carga horária de <strong>{totalHoras} horas</strong>,
          realizado nos dias 23 e 24 de julho de 2026.
        </p>
      </div>

      <style>{`
        .certificado-page {
          position: relative;
          width: 1000px;
          max-width: 100%;
          aspect-ratio: 1414 / 1000;
          background: #fff;
          box-shadow: 0 10px 40px rgba(0,0,0,0.12);
        }
        .cert-bg {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }
        .cert-overlay {
          position: absolute;
          top: 32%;
          left: 8%;
          width: 42%;
          color: #111;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .cert-intro {
          font-size: 22px;
          margin: 0;
          color: #222;
        }
        .cert-nome {
          font-size: 32px;
          font-weight: 800;
          margin: 4px 0 2px 0;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cert-cpf {
          font-size: 18px;
          margin: 0 0 22px 0;
          color: #222;
        }
        .cert-body {
          font-size: 20px;
          margin: 0 0 8px 0;
        }
        .cert-lista {
          list-style: disc;
          padding-left: 22px;
          margin: 0 0 14px 0;
          font-size: 18px;
          line-height: 1.4;
        }
        .cert-lista li { margin-bottom: 4px; }
        .cert-total {
          font-size: 18px;
          margin: 0;
          line-height: 1.45;
        }

        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .certificado-page, .certificado-page * { visibility: visible !important; }
          .certificado-page {
            position: fixed !important;
            top: 0; left: 0;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
