import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Printer, Search, Files, Download } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { consultarInscricaoPorCpf, type ConsultaResultado } from "@/lib/oficinas";
import { cpfValido, formatarCpf, normalizarCpf } from "@/lib/format";
import { abreviarNome } from "@/lib/nome";
import certificadoBase from "@/assets/certificado-base.png.asset.json";

type SearchParams = { cpf?: string; bulk?: boolean };

export const Route = createFileRoute("/certificado")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    cpf: typeof s.cpf === "string" ? s.cpf : undefined,
    bulk: s.bulk === true || s.bulk === "1" || s.bulk === "true" ? true : undefined,
  }),
  component: CertificadoPage,
});

type CertData = {
  nome: string;
  cpf: string;
  oficinas: { titulo: string; horas: number }[];
  totalHoras: number;
};

function CertificadoPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      setChecking(false);
      if (!data.session) {
        navigate({ to: "/admin" });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!sessionEmail) return null;

  return <PainelCertificado />;
}

function PainelCertificado() {
  const { cpf: cpfSearch } = Route.useSearch();
  const [cpf, setCpf] = useState(cpfSearch ?? "");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkData, setBulkData] = useState<CertData[] | null>(null);
  const [bulkQuery, setBulkQuery] = useState("");
  const [downloading, setDownloading] = useState<{ atual: number; total: number } | null>(null);
  const [singleDownloading, setSingleDownloading] = useState<string | null>(null);
  const [preview, setPreview] = useState<CertData | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const bulk = true;


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

  async function carregarTodos() {
    setBulkLoading(true);
    try {
      const [insR, prR, ofR] = await Promise.all([
        supabase.from("inscricoes").select("id,nome,cpf,oficina_quinta_id,oficina_sexta_id"),
        supabase.from("presencas").select("inscricao_id,oficina_id,manha,tarde"),
        supabase.from("oficinas").select("id,titulo"),
      ]);
      if (insR.error) throw insR.error;
      if (prR.error) throw prR.error;
      if (ofR.error) throw ofR.error;

      const ofMap = new Map((ofR.data ?? []).map((o) => [o.id, o.titulo]));
      const prMap = new Map<string, { manha: boolean; tarde: boolean }>();
      for (const p of prR.data ?? []) {
        prMap.set(`${p.inscricao_id}:${p.oficina_id}`, {
          manha: !!p.manha,
          tarde: !!p.tarde,
        });
      }
      const horasDe = (insId: string, ofId: string) => {
        const p = prMap.get(`${insId}:${ofId}`);
        if (!p) return 0;
        return (p.manha ? 4 : 0) + (p.tarde ? 4 : 0);
      };

      const certs: CertData[] = [];
      for (const i of insR.data ?? []) {
        const oficinas: { titulo: string; horas: number }[] = [];
        const hQ = i.oficina_quinta_id ? horasDe(i.id, i.oficina_quinta_id) : 0;
        const hS = i.oficina_sexta_id ? horasDe(i.id, i.oficina_sexta_id) : 0;
        if (hQ > 0 && i.oficina_quinta_id) oficinas.push({ titulo: ofMap.get(i.oficina_quinta_id) ?? "", horas: hQ });
        if (hS > 0 && i.oficina_sexta_id) oficinas.push({ titulo: ofMap.get(i.oficina_sexta_id) ?? "", horas: hS });
        if (oficinas.length === 0) continue;
        certs.push({
          nome: i.nome,
          cpf: i.cpf,
          oficinas,
          totalHoras: hQ + hS,
        });
      }
      certs.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setBulkData(certs);
      if (certs.length === 0) toast.info("Nenhum participante com presença registrada.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar certificados.");
    } finally {
      setBulkLoading(false);
    }
  }

  useEffect(() => {
    if (bulk) carregarTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulk]);

  const bulkFiltered = useMemo(() => {
    if (!bulkData) return null;
    const q = bulkQuery.trim().toLowerCase();
    if (!q) return bulkData;
    const qDigits = q.replace(/\D/g, "");
    return bulkData.filter((c) => {
      const nomeMatch = c.nome.toLowerCase().includes(q);
      const cpfMatch = qDigits.length > 0 && (c.cpf || "").replace(/\D/g, "").includes(qDigits);
      return nomeMatch || cpfMatch;
    });
  }, [bulkData, bulkQuery]);

  async function baixarTodosPdf() {
    const lista = bulkFiltered ?? [];
    if (lista.length === 0) {
      toast.error("Nenhum certificado carregado.");
      return;
    }
    setDownloading({ atual: 0, total: lista.length });
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
    document.body.appendChild(holder);
    const { renderCertificadoOffscreen } = await import("@/lib/certificado-render");
    try {
      for (let i = 0; i < lista.length; i++) {
        const c = lista[i];
        setDownloading({ atual: i + 1, total: lista.length });
        const node = renderCertificadoOffscreen(holder, c, certificadoBase.url);
        // aguardar imagem carregar
        const img = node.querySelector("img");
        if (img && !img.complete) {
          await new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          });
        }
        await new Promise((r) => setTimeout(r, 60));
        const canvas = await html2canvas(node, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          onclone: (doc) => {
            const style = doc.createElement("style");
            style.textContent = `
              html, body { background: #ffffff !important; }
              *, *::before, *::after {
                color: #111111 !important;
                border-color: #000000 !important;
                outline-color: #000000 !important;
                text-decoration-color: #000000 !important;
                caret-color: #000000 !important;
                box-shadow: none !important;
                text-shadow: none !important;
              }
              *:not(.cert-safe):not(.cert-safe *) { background-color: transparent !important; background-image: none !important; }
              .cert-safe { background-color: #ffffff !important; }
            `;
            doc.head.appendChild(style);
          },
        });
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
        const cpfLimpo = (c.cpf || "").replace(/\D/g, "");
        pdf.save(`${cpfLimpo}.pdf`);
        node.remove();
        await new Promise((r) => setTimeout(r, 30));
      }
      toast.success(`${lista.length} certificado(s) baixado(s).`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDFs em lote.");
    } finally {
      holder.remove();
      setDownloading(null);
    }
  }

  async function baixarUm(c: CertData) {
    setSingleDownloading(c.cpf);
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
    document.body.appendChild(holder);
    const { renderCertificadoOffscreen } = await import("@/lib/certificado-render");
    try {
      const node = renderCertificadoOffscreen(holder, c, certificadoBase.url);
      const img = node.querySelector("img");
      if (img && !img.complete) {
        await new Promise<void>((res) => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        });
      }
      await new Promise((r) => setTimeout(r, 60));
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        onclone: (doc) => {
          const style = doc.createElement("style");
          style.textContent = `
            html, body { background: #ffffff !important; }
            *, *::before, *::after {
              color: #111111 !important;
              border-color: #000000 !important;
              outline-color: #000000 !important;
              text-decoration-color: #000000 !important;
              caret-color: #000000 !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
            *:not(.cert-safe):not(.cert-safe *) { background-color: transparent !important; background-image: none !important; }
            .cert-safe { background-color: #ffffff !important; }
          `;
          doc.head.appendChild(style);
        },
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
      pdf.save(`${(c.cpf || "").replace(/\D/g, "")}.pdf`);
      node.remove();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao baixar certificado.");
    } finally {
      holder.remove();
      setSingleDownloading(null);
    }
  }

  const oficinasComHoras = useMemo(() => {
    if (resultado?.status !== "encontrado") return [];
    return [resultado.oficina_quinta, resultado.oficina_sexta].filter((o) => o.horas > 0);
  }, [resultado]);
  const totalHoras = oficinasComHoras.reduce((s, o) => s + o.horas, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold">Certificados (Admin)</div>
          <div className="flex items-center gap-2">
            <Link
              to="/certificado"
              search={{ bulk: true }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted"
            >
              <Files className="h-4 w-4" /> Baixar todos
            </Link>
            <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-3 w-3" /> Painel
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 print:p-0 print:max-w-none">
        {!bulk && (
          <section className="card-elevated p-6 print:hidden">
            <h1 className="text-2xl font-bold">Gerar certificado individual</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Digite o CPF do participante. Só entram no certificado as oficinas com presença registrada.
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
        )}

        {!bulk && resultado?.status === "encontrado" && oficinasComHoras.length === 0 && (
          <div className="card-elevated mt-6 p-6 text-center print:hidden">
            <p className="text-sm text-muted-foreground">
              Ainda não há presença registrada nas oficinas. O certificado será gerado após a chamada.
            </p>
          </div>
        )}

        {!bulk && resultado?.status === "encontrado" && oficinasComHoras.length > 0 && (
          <>
            <div className="mt-6 flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
              </button>
            </div>
            <div className="cert-print-area mt-4 flex justify-center print:mt-0">
              <Certificado
                nome={resultado.nome}
                cpf={cpf}
                oficinas={oficinasComHoras.map((o) => ({ titulo: o.titulo, horas: o.horas }))}
                totalHoras={totalHoras}
              />
            </div>
          </>
        )}

        {bulk && (
          <section className="print:hidden">
            <div className="card-elevated flex flex-wrap items-center justify-between gap-3 p-6">
              <div>
                <h1 className="text-2xl font-bold">Certificados em massa</h1>
                <p className="text-sm text-muted-foreground">
                  {bulkLoading
                    ? "Carregando..."
                    : bulkData
                      ? bulkQuery.trim()
                        ? `${bulkFiltered?.length ?? 0} de ${bulkData.length} certificado(s).`
                        : `${bulkData.length} certificado(s) prontos para impressão.`
                      : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={carregarTodos}
                  disabled={bulkLoading || !!downloading}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <Loader2 className={`h-4 w-4 ${bulkLoading ? "animate-spin" : "hidden"}`} />
                  Recarregar
                </button>
                <button
                  onClick={baixarTodosPdf}
                  disabled={!bulkData || bulkData.length === 0 || !!downloading}
                  className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Baixando {downloading.atual}/{downloading.total}...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> Baixar todos (PDFs)
                    </>
                  )}
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!bulkData || bulkData.length === 0 || !!downloading}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </div>
            {bulkData && bulkData.length > 0 && (
              <div className="card-elevated mt-4 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    value={bulkQuery}
                    onChange={(e) => setBulkQuery(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              </div>
            )}
          </section>
        )}



        {/* holder off-screen usado por baixarTodosPdf */}
        <div
          ref={captureRef}
          aria-hidden
          style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
        />


        {bulk && bulkFiltered && (
          <>
            {bulkFiltered.length === 0 && (
              <p className="mt-6 text-center text-sm text-muted-foreground print:hidden">
                Nenhum certificado encontrado para "{bulkQuery}".
              </p>
            )}

            {bulkFiltered.length > 0 && (
              <div className="mt-4 space-y-3 print:hidden">
                {bulkFiltered.map((c) => (
                  <div
                    key={c.cpf}
                    className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="text-sm text-muted-foreground">{formatarCpf(c.cpf)}</p>
                      <p className="text-xs text-muted-foreground">{c.totalHoras}h</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setPreview(c)}
                        disabled={!!downloading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        <Search className="h-4 w-4" /> Visualizar
                      </button>
                      <button
                        onClick={() => baixarUm(c)}
                        disabled={singleDownloading === c.cpf || !!downloading}
                        className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {singleDownloading === c.cpf ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Baixar
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* Área de impressão oculta na tela */}
            {bulkFiltered.length > 0 && (
              <div className="cert-print-area mt-4 hidden print:mt-0 print:block print:space-y-0">
                {bulkFiltered.map((c, idx) => (
                  <div key={idx} className="cert-page-wrap flex justify-center">
                    <Certificado nome={c.nome} cpf={c.cpf} oficinas={c.oficinas} totalHoras={c.totalHoras} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-800">
                {preview.nome} — {formatarCpf(preview.cpf)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => baixarUm(preview)}
                  disabled={singleDownloading === preview.cpf}
                  className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {singleDownloading === preview.cpf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar PDF
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <Certificado
                nome={preview.nome}
                cpf={preview.cpf}
                oficinas={preview.oficinas}
                totalHoras={preview.totalHoras}
              />
            </div>
          </div>
        </div>
      )}


      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body > *:not(.__print-root) { }
          header, nav, .print\\:hidden { display: none !important; }
          .cert-page-wrap { page-break-after: always; break-after: page; }
          .cert-page-wrap:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
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
  const nomeExibicao = abreviarNome(nome, 32).toUpperCase();
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
          top: 28%;
          left: 5%;
          width: 40%;
          text-align: center;
          color: #111;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          word-wrap: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
        }
        .cert-intro { font-size: 17px; margin: 0; color: #222; }
        .cert-nome {
          font-size: 22px; font-weight: 800;
          margin: 6px 0 4px 0; line-height: 1.15;
          overflow-wrap: break-word;
        }
        .cert-cpf { font-size: 14px; margin: 0 0 18px 0; color: #222; }
        .cert-body { font-size: 15px; margin: 0 0 8px 0; }
        .cert-lista {
          list-style: none; padding: 0;
          margin: 0 auto 12px auto; font-size: 15px; line-height: 1.45;
          max-width: 100%;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .cert-lista li { margin-bottom: 4px; overflow-wrap: break-word; word-wrap: break-word; }
        .cert-total { font-size: 14px; margin: 0; line-height: 1.5; overflow-wrap: break-word; }

        @media print {
          .certificado-page {
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
