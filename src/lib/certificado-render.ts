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
        `<li style="margin-bottom:4px;color:#111111;"><strong style="color:#111111;">${escapeHtml(o.titulo)}</strong> — ${o.horas} horas</li>`,
    )
    .join("");

  const node = document.createElement("div");
  node.style.cssText =
    "position:relative;width:1400px;height:990px;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111111;";
  node.innerHTML = `
    <style>
      .cert-safe, .cert-safe * {
        color: #111111;
        background-color: transparent;
        border-color: #000000;
        caret-color: #000000;
        text-decoration-color: #000000;
        outline-color: #000000;
        box-shadow: none;
        text-shadow: none;
      }
      .cert-safe { background-color: #ffffff; }
    </style>
    <div class="cert-safe" style="position:absolute;inset:0;">
      <img src="${imgUrl}" alt="" crossorigin="anonymous" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" />
      <div style="position:absolute;top:28%;left:3%;width:40%;text-align:center;word-wrap:break-word;overflow-wrap:break-word;">
        <p style="font-size:19px;margin:0;color:#222222;">Certificamos que</p>
        <p style="font-size:30px;font-weight:800;margin:6px 0 4px 0;line-height:1.15;overflow-wrap:break-word;color:#111111;">${escapeHtml(nomeExibicao)},</p>
        <p style="font-size:16px;margin:0 0 20px 0;color:#222222;">inscrito(a) no CPF ${escapeHtml(cpfFmt)}</p>
        <p style="font-size:17px;margin:0 0 8px 0;color:#111111;">participou ${umaOficina ? "da oficina:" : "das oficinas:"}</p>
        <ul style="list-style:none;padding:0;margin:0 auto 12px auto;font-size:17px;line-height:1.45;word-wrap:break-word;overflow-wrap:break-word;color:#111111;">${oficinasHtml}</ul>
        <p style="font-size:16px;margin:0;line-height:1.5;overflow-wrap:break-word;color:#111111;">totalizando carga horária de <strong style="color:#111111;">${c.totalHoras} horas</strong>, realizado nos dias 23 e 24 de julho de 2026.</p>
      </div>
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
