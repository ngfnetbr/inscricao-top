import { jsPDF } from "jspdf";
import { formatarCpf } from "./format";
import type { OficinaComVagas } from "./oficinas";

type Inscricao = { id: string; nome: string; cpf: string };

const DIA_LABEL: Record<string, string> = {
  quinta: "Quinta-feira 23/07",
  sexta: "Sexta-feira 24/07",
};

export function gerarPdfOficinas(
  oficinas: OficinaComVagas[],
  participantesPorOficina: Map<string, Inscricao[]>,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ativas = oficinas
    .filter((o) => o.ativa)
    .sort((a, b) => {
      if (a.dia !== b.dia) return a.dia === "quinta" ? -1 : 1;
      return (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, "pt-BR");
    });

  function ensure(space: number) {
    if (y + space > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Oficinas e Participantes", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 20;

  let diaAtual = "";
  for (const o of ativas) {
    if (o.dia !== diaAtual) {
      diaAtual = o.dia;
      ensure(40);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(DIA_LABEL[o.dia] ?? o.dia, margin, y);
      y += 14;
      doc.setDrawColor(200);
      doc.line(margin, y, pageW - margin, y);
      y += 12;
    }

    const participantes = participantesPorOficina.get(o.id) ?? [];
    ensure(60);

    // Cabeçalho da oficina
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const tituloLinhas = doc.splitTextToSize(o.titulo, pageW - margin * 2);
    doc.text(tituloLinhas, margin, y);
    y += tituloLinhas.length * 13;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    const meta = `Ministrante: ${o.ministrante} · Público-alvo: ${o.publico_alvo} · Inscritos: ${participantes.length}/${o.limite_vagas}`;
    const metaLinhas = doc.splitTextToSize(meta, pageW - margin * 2);
    doc.text(metaLinhas, margin, y);
    y += metaLinhas.length * 11 + 6;
    doc.setTextColor(0);

    // Lista
    doc.setFontSize(10);
    if (participantes.length === 0) {
      ensure(14);
      doc.setTextColor(140);
      doc.text("— sem inscritos —", margin + 10, y);
      doc.setTextColor(0);
      y += 14;
    } else {
      participantes.forEach((p, idx) => {
        ensure(14);
        const linha = `${String(idx + 1).padStart(2, "0")}. ${p.nome}   —   ${formatarCpf(p.cpf)}`;
        doc.text(linha, margin + 10, y);
        y += 13;
      });
    }
    y += 10;
  }

  // Rodapé com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`oficinas-participantes-${new Date().toISOString().slice(0, 10)}.pdf`);
}
