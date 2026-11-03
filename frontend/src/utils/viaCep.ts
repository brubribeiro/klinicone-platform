export interface ViaCepOk {
  cep: string;
  logradouro: string;
  complemento: string;
  unidade?: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/** ViaCEP responde 200 com `{ erro: true }` ou `{ erro: "true" }` quando o CEP não existe. */
export function isViaCepErrorResponse(body: Record<string, unknown>): boolean {
  const erro = body.erro;
  if (erro === true) return true;
  if (typeof erro === 'string' && erro.toLowerCase() === 'true') return true;
  return false;
}

export function formatAddressFromViaCep(data: ViaCepOk): string {
  const cityUf =
    data.localidade && data.uf
      ? `${data.localidade}/${data.uf}`
      : data.localidade || data.uf || '';
  const chunks = [data.logradouro, data.bairro, cityUf].filter((s) => s && String(s).trim().length > 0);
  return chunks.join(', ');
}

export async function fetchViaCepDigits(
  eightDigits: string,
  signal?: AbortSignal,
): Promise<ViaCepOk | null> {
  const clean = eightDigits.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const url = `https://viacep.com.br/ws/${clean}/json/`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as Record<string, unknown>;
  if (isViaCepErrorResponse(body)) return null;

  const localidade = String(body.localidade ?? '').trim();
  const uf = String(body.uf ?? '').trim();
  if (!localidade && !uf) return null;

  return body as unknown as ViaCepOk;
}
