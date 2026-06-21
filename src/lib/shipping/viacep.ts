export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return data as ViaCepResult;
  } catch {
    return null;
  }
}
