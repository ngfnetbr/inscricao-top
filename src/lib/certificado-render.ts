import { abreviarNome } from "./nome";
import { formatarCpf } from "./format";

export type CertificadoData = {
  nome: string;
  cpf: string;
  oficinas: { titulo: string; horas: number }[];
  totalHoras: number;
};

/**
 * Cria um nó DOM off-screen (dentro do holder informado) contendo um
 * certificado pronto para ser capturado por html2canvas. Retorna o nó criado
 * para que o chamador possa capturá-lo e removê-lo.
 */
export function renderCertificadoOffscreen(
  holder: HTMLElement,
  c: CertificadoData,
  imgUrl: string,
): HTMLDivElement {
  const nomeExibicao = abreviarNome(c.nome, 32);
  const umaOficina = c.oficinas.length === 1;
  const cpfFmt = formatarCpf(c.cpf);

  const oficinasHtml = c.oficinas
    .map(
      (o) =>
        `<li style="margin-bottom:4px;"><strong>${escapeHtml(o.titulo)}</strong> — ${o.horas} horas</li>`,
    )
    .join("");

  const node = document.createElement("div");
  node.style.cssText =
    "position:relative;width:1400px;height:990px;background:#fff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;";
  node.innerHTML = `
    <img src="${imgUrl}" alt="" crossorigin="anonymous" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" />
    <div style="position:absolute;top:38%;left:10%;width:80%;text-align:center;">
      <p style="font-size:18px;margin:0;color:#222;">Certificamos que</p>
      <p style="font-size:26px;font-weight:800;margin:4px 0 2px 0;line-height:1.15;">${escapeHtml(nomeExibicao)},</p>
      <p style="font-size:15px;margin:0 0 18px 0;color:#222;">inscrito(a) no CPF ${escapeHtml(cpfFmt)}</p>
      <p style="font-size:16px;margin:0 0 8px 0;">participou ${umaOficina ? "da oficina:" : "das oficinas:"}</p>
      <ul style="list-style:none;padding:0;margin:0 auto 12px auto;font-size:15px;line-height:1.4;max-width:900px;">${oficinasHtml}</ul>
      <p style="font-size:15px;margin:0;line-height:1.45;">totalizando carga horária de <strong>${c.totalHoras} horas</strong>, realizado nos dias 23 e 24 de julho de 2026.</p>
    </div>
  `;
  holder.appendChild(node);
  return node;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
