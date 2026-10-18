/**
 * App Android (TWA da Google Play) de cada clube e Digital Asset Links.
 *
 * O app abre o site do clube em tela cheia quando o Android confirma que o domínio
 * autoriza o pacote. A confirmação é feita pelo arquivo
 * `https://<domínio>/.well-known/assetlinks.json`, montado aqui a partir de duas
 * chaves da configuração do clube:
 * - androidPackageName: applicationId do app (ex.: com.clube.app);
 * - androidCertFingerprints: JSON com a lista de impressões digitais SHA-256 dos
 *   certificados de assinatura (assinatura do app e, se houver, chave de upload).
 *
 * Módulo puro (sem I/O e sem "use server"): usado pela action de gravação
 * (updateConfigValues), pela rota /.well-known/assetlinks.json e pelo formulário do admin.
 */

export const ANDROID_PACKAGE_NAME_KEY = "androidPackageName";
export const ANDROID_CERT_FINGERPRINTS_KEY = "androidCertFingerprints";
export const ANDROID_APP_KEYS = [ANDROID_PACKAGE_NAME_KEY, ANDROID_CERT_FINGERPRINTS_KEY] as const;

export const ANDROID_PACKAGE_NAME_MAX_CHARS = 100;
/** Chave de assinatura do app + chave de upload + folga para uma rotação. */
export const ANDROID_FINGERPRINTS_MAX = 5;

const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
/** SHA-256 = 32 bytes em hex, em pares separados por dois-pontos. Canônica: maiúsculas. */
const SHA256_CANONICAL_RE = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;
const HANDLE_ALL_URLS = "delegate_permission/common.handle_all_urls";

export interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

/** Nome de pacote Android válido, até 100 caracteres. Sem espaço nem trim implícito. */
export function isValidAndroidPackageName(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= ANDROID_PACKAGE_NAME_MAX_CHARS &&
    PACKAGE_NAME_RE.test(value)
  );
}

/**
 * Impressão digital SHA-256 para a forma canônica (maiúsculas, com dois-pontos).
 * Aceita minúsculas e espaços nas bordas; devolve null se não for SHA-256 em hex com dois-pontos.
 */
export function normalizeSha256Fingerprint(value: string): string | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return SHA256_CANONICAL_RE.test(upper) ? upper : null;
}

/**
 * Valor GRAVADO de androidCertFingerprints: JSON com 1 a 5 impressões canônicas,
 * sem repetição. Devolve a lista ou null se o formato não for exatamente esse.
 */
export function parseStoredFingerprints(raw: string): string[] | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length < 1 || parsed.length > ANDROID_FINGERPRINTS_MAX) return null;
  for (const item of parsed) {
    if (typeof item !== "string" || !SHA256_CANONICAL_RE.test(item)) return null;
  }
  if (new Set(parsed).size !== parsed.length) return null;
  return parsed as string[];
}

/**
 * Leitura TOLERANTE do valor já gravado (usado ao montar a resposta pública): o que não
 * for impressão válida é descartado; normaliza maiúsculas, remove repetidas e limita a 5.
 * Nunca lança exceção e nunca devolve um valor fora do formato canônico.
 */
export function readStoredFingerprints(raw: string | null | undefined): string[] {
  if (typeof raw !== "string" || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const fp = normalizeSha256Fingerprint(item);
    if (fp && !out.includes(fp)) out.push(fp);
    if (out.length === ANDROID_FINGERPRINTS_MAX) break;
  }
  return out;
}

/**
 * Valor de UMA chave do app Android gravada por `updateConfigValues`. Vazio = remover.
 * Chaves fora deste módulo: sempre válidas (quem decide são as outras validações).
 */
export function isValidAndroidAppConfigValue(key: string, value: string): boolean {
  switch (key) {
    case ANDROID_PACKAGE_NAME_KEY:
      return value === "" || isValidAndroidPackageName(value);
    case ANDROID_CERT_FINGERPRINTS_KEY:
      return value === "" || parseStoredFingerprints(value) !== null;
    default:
      return true;
  }
}

/**
 * Corpo de /.well-known/assetlinks.json a partir das linhas de configuração do clube.
 * Devolve null (= sem app configurado) quando falta pacote válido ou impressão válida.
 * Só entram valores que passam na validação; o resto nunca chega à resposta.
 */
export function buildAssetLinkStatements(
  rows: { key: string; value: string }[],
): AssetLinkStatement[] | null {
  const values = new Map(rows.map((r) => [r.key, r.value]));
  const packageName = values.get(ANDROID_PACKAGE_NAME_KEY) ?? "";
  if (!isValidAndroidPackageName(packageName)) return null;

  const fingerprints = readStoredFingerprints(values.get(ANDROID_CERT_FINGERPRINTS_KEY));
  if (fingerprints.length === 0) return null;

  return [
    {
      relation: [HANDLE_ALL_URLS],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export type FingerprintInputResult =
  | { ok: true; list: string[]; value: string }
  | { ok: false; error: string };

/**
 * Converte o texto do formulário (uma impressão por linha) no valor gravado.
 * Linha vazia é ignorada. Texto vazio vira value "" (remove as impressões).
 */
export function fingerprintsFromInput(text: string): FingerprintInputResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0) return { ok: true, list: [], value: "" };
  if (lines.length > ANDROID_FINGERPRINTS_MAX) {
    return {
      ok: false,
      error: `Use no máximo ${ANDROID_FINGERPRINTS_MAX} impressões digitais.`,
    };
  }
  const list: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const fp = normalizeSha256Fingerprint(lines[i]);
    if (!fp) {
      return {
        ok: false,
        error: `Linha ${i + 1} inválida: a impressão deve ser SHA-256 com 32 pares hex separados por dois-pontos (AA:BB:...).`,
      };
    }
    if (list.includes(fp)) {
      return { ok: false, error: `Linha ${i + 1} repetida.` };
    }
    list.push(fp);
  }
  return { ok: true, list, value: JSON.stringify(list) };
}

/** Texto do formulário (uma impressão por linha) a partir do valor gravado. */
export function fingerprintsToInputText(raw: string | null | undefined): string {
  return readStoredFingerprints(raw).join("\n");
}
