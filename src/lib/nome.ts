export function abreviarNome(nome: string, maxChars = 32): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  if (partes.join(" ").length <= maxChars) return partes.join(" ");

  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const meio = partes.slice(1, -1);

  // Abrevia progressivamente do início do meio pro fim até caber.
  for (let i = 0; i <= meio.length; i++) {
    const meioAbrev = meio.map((p, idx) =>
      idx < i ? (p.length > 2 ? p[0].toUpperCase() + "." : p) : p,
    );
    const candidato = [primeiro, ...meioAbrev, ultimo].join(" ");
    if (candidato.length <= maxChars) return candidato;
  }
  // fallback: todos os meios como iniciais
  return [primeiro, ...meio.map((p) => (p.length > 2 ? p[0].toUpperCase() + "." : p)), ultimo].join(" ");
}
