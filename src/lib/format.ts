export function normalizarCpf(input: string): string {
  return (input ?? "").replace(/\D/g, "").slice(0, 11);
}

export function formatarCpf(input: string): string {
  const d = normalizarCpf(input);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "-" + p4;
  return out;
}

export function cpfValido(input: string): boolean {
  const cpf = normalizarCpf(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

export function textoVagas(vagas: number, lotada: boolean): string {
  if (lotada || vagas <= 0) return "Oficina lotada";
  if (vagas === 1) return "1 vaga disponível";
  return `${vagas} vagas disponíveis`;
}
