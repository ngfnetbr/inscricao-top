import { jsPDF } from "jspdf";
import { listarParticipantesPublico, type ParticipantePublico } from "./oficinas";
import logoConversas from "@/assets/conversas-pedagogicas.png.asset.json";

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

type Grupo = {
  oficina_id: string;
  dia: string;
  titulo: string;
  ministrante: string;
  publico_alvo: string | null;
  ordem: number;
  participantes: ParticipantePublico[];
};

export async function gerarPdfPresencas() {
  const dados = await listarParticipantesPublico();

  // Agrupar por oficina
  const mapa = new Map<string, Grupo>();
  for (const r of dados) {
    if (!r.oficina_id) continue;
    let g = mapa.get(r.oficina_id);
    if (!g) {
      g = {
        oficina_id: r.oficina_id,
        dia: r.dia,
        titulo: r.titulo,
        ministrante: r.ministrante,
        publico_alvo: r.publico_alvo,
        ordem: r.ordem,
        participantes: [],
      };
      mapa.set(r.oficina_id, g);
    }
    if (r.nome) g.participantes.push(r);
  }

  const grupos = Array.from(mapa.values()).sort((a, b) => {
    if (a.dia !== b.dia) return a.dia === "quinta" ? -1 : 1;
    return (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, "pt-BR");
  });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const logo = await carregarLogo(logoConversas.url);

  grupos.forEach((g, idx) => {
    if (idx > 0) doc.addPage();
    let y = margin;

    if (logo) {
      const maxW = 180;
      const maxH = 80;
      const ratio = Math.min(maxW / logo.w, maxH / logo.h);
      const w = logo.w * ratio;
      const h = logo.h * ratio;
      doc.addImage(logo.data, "PNG", (pageW - w) / 2, y, w, h);
      y += h + 12;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text((DIA_LABEL[g.dia] ?? g.dia).toUpperCase(), pageW / 2, y, { align: "center" });
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(20);
    const tituloLinhas = doc.splitTextToSize(g.titulo, pageW - margin * 2);
    doc.text(tituloLinhas, pageW / 2, y, { align: "center" });
    y += tituloLinhas.length * 17;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Ministrante: ${g.ministrante}`, pageW / 2, y, { align: "center" });
    y += 18;

    // Totais
    const total = g.participantes.length;
    const compl = g.participantes.filter((p) => p.manha && p.tarde).length;
    const parc = g.participantes.filter((p) => (p.manha || p.tarde) && !(p.manha && p.tarde)).length;
    const aus = g.participantes.filter((p) => !p.manha && !p.tarde).length;

    doc.setDrawColor(210);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(
      `Chamada — ${total} participante(s) · ${compl} completa(s) · ${parc} parcial(is) · ${aus} ausência(s)`,
      margin,
      y,
    );
    y += 16;

    // Cabeçalho tabela
    const colN = margin + 6;
    const colNome = margin + 30;
    const colManha = pageW - margin - 150;
    const colTarde = pageW - margin - 80;
    const colHoras = pageW - margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text("#", colN, y);
    doc.text("Nome", colNome, y);
    doc.text("Manhã", colManha, y, { align: "center" });
    doc.text("Tarde", colTarde, y, { align: "center" });
    doc.text("Horas", colHoras, y, { align: "right" });
    y += 6;
    doc.setDrawColor(230);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);

    function ensure(space: number) {
      if (y + space > pageH - margin - 20) {
        doc.addPage();
        y = margin;
      }
    }

    const marca = (v: boolean) => (v ? "P" : "F");

    if (g.participantes.length === 0) {
      doc.setTextColor(140);
      doc.text("— sem inscritos —", margin + 6, y);
      doc.setTextColor(30);
    } else {
      g.participantes
        .slice()
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"))
        .forEach((p, i) => {
          ensure(16);
          const num = String(i + 1).padStart(2, "0");
          doc.setTextColor(30);
          doc.text(num, colN, y);
          const nome = doc.splitTextToSize(p.nome ?? "", colManha - colNome - 10)[0];
          doc.text(nome, colNome, y);

          // Manhã
          doc.setTextColor(p.manha ? 20 : 180);
          doc.text(marca(p.manha), colManha, y, { align: "center" });
          // Tarde
          doc.setTextColor(p.tarde ? 20 : 180);
          doc.text(marca(p.tarde), colTarde, y, { align: "center" });
          // Horas
          doc.setTextColor(30);
          doc.text(`${p.horas}h`, colHoras, y, { align: "right" });
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
    doc.text(`P = Presente · F = Falta/Não registrado`, margin, pageH - 20);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`presencas-${new Date().toISOString().slice(0, 10)}.pdf`);
}
