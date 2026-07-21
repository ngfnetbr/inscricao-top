import { jsPDF } from "jspdf";
import { formatarCpf } from "./format";
import type { OficinaComVagas } from "./oficinas";
import logoConversas from "@/assets/conversas-pedagogicas.png.asset.json";

type Inscricao = { id: string; nome: string; cpf: string };

const DIA_LABEL: Record<string, string> = {
  quinta: "Quinta-feira, 23/07",
  sexta: "Sexta-feira, 24/07",
};

async function carregarLogo(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = rej;
      img.src = dataUrl;
    });
    return { data: dataUrl, ...dims };
  } catch {
    return null;
  }
}

export async function gerarPdfOficinas(
  oficinas: OficinaComVagas[],
  participantesPorOficina: Map<string, Inscricao[]>,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const ativas = oficinas
    .filter((o) => o.ativa)
    .sort((a, b) => {
      if (a.dia !== b.dia) return a.dia === "quinta" ? -1 : 1;
      return (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, "pt-BR");
    });

  const logo = await carregarLogo(logoConversas.url);

  ativas.forEach((o, idx) => {
    if (idx > 0) doc.addPage();
    let y = margin;

    // Logo centralizado
    if (logo) {
      const maxW = 200;
      const maxH = 90;
      const ratio = Math.min(maxW / logo.w, maxH / logo.h);
      const w = logo.w * ratio;
      const h = logo.h * ratio;
      doc.addImage(logo.data, "PNG", (pageW - w) / 2, y, w, h);
      y += h + 16;
    }

    // Dia (badge acima)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text((DIA_LABEL[o.dia] ?? o.dia).toUpperCase(), pageW / 2, y, { align: "center" });
    y += 16;

    // Título oficina
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20);
    const tituloLinhas = doc.splitTextToSize(o.titulo, pageW - margin * 2);
    doc.text(tituloLinhas, pageW / 2, y, { align: "center" });
    y += tituloLinhas.length * 18;

    // Ministrante
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`Ministrante: ${o.ministrante}`, pageW / 2, y, { align: "center" });
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Público-alvo: ${o.publico_alvo}`, pageW / 2, y, { align: "center" });
    y += 20;

    // Linha divisória
    doc.setDrawColor(210);
    doc.line(margin, y, pageW - margin, y);
    y += 16;

    // Cabeçalho lista
    const participantes = participantesPorOficina.get(o.id) ?? [];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(
      `Participantes (${participantes.length}/${o.limite_vagas})`,
      margin,
      y,
    );
    y += 16;

    // Lista
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);

    function ensure(space: number) {
      if (y + space > pageH - margin - 20) {
        doc.addPage();
        y = margin;
      }
    }

    if (participantes.length === 0) {
      doc.setTextColor(140);
      doc.text("— sem inscritos —", margin + 6, y);
      doc.setTextColor(30);
    } else {
      participantes.forEach((p, i) => {
        ensure(14);
        const num = String(i + 1).padStart(2, "0");
        doc.text(`${num}.  ${p.nome}`, margin + 6, y);
        doc.setTextColor(120);
        doc.text(formatarCpf(p.cpf), pageW - margin, y, { align: "right" });
        doc.setTextColor(30);
        y += 14;
      });
    }
  });

  // Rodapé
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      margin,
      pageH - 20,
    );
    doc.setTextColor(0);
  }

  doc.save(`oficinas-participantes-${new Date().toISOString().slice(0, 10)}.pdf`);
}
