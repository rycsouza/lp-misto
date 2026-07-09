// Validação de CPF (dígito verificador). Módulo PURO — sem dependências de Node,
// seguro para importar tanto no servidor quanto em client components.

export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function formatCPF(cpf: string): string {
  const d = normalizeCPF(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** true se o CPF é válido (11 dígitos + dígitos verificadores corretos). */
export function validateCPF(cpf: string): boolean {
  const d = normalizeCPF(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais (ex.: 111.111.111-11)

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(d[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 >= 10) check2 = 0;
  if (check2 !== parseInt(d[10])) return false;

  return true;
}
