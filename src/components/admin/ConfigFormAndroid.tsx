"use client";

import { useState, useTransition } from "react";
import { updateConfigValues } from "@/app/actions/admin";
import {
  ANDROID_CERT_FINGERPRINTS_KEY,
  ANDROID_PACKAGE_NAME_KEY,
  fingerprintsFromInput,
  isValidAndroidPackageName,
} from "@/lib/android-app/assetlinks";
import { Check, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  packageName: string;
  /** Impressões gravadas, uma por linha (ver fingerprintsToInputText no servidor). */
  fingerprints: string;
}

const inputClass =
  "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

export function ConfigFormAndroid({ packageName: initialPackage, fingerprints: initialFingerprints }: Props) {
  const [packageName, setPackageName] = useState(initialPackage);
  const [fingerprints, setFingerprints] = useState(initialFingerprints);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const pkg = packageName.trim();
    if (pkg !== "" && !isValidAndroidPackageName(pkg)) {
      setError("Nome do pacote inválido. Use o formato com.clube.app (letras, números e _, separados por pontos).");
      return;
    }
    const parsed = fingerprintsFromInput(fingerprints);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startTransition(async () => {
      try {
        // O servidor valida de novo e recusa o lote inteiro se algo estiver fora do formato.
        await updateConfigValues({
          [ANDROID_PACKAGE_NAME_KEY]: pkg,
          [ANDROID_CERT_FINGERPRINTS_KEY]: parsed.value,
        });
        setPackageName(pkg);
        setFingerprints(parsed.list.join("\n"));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Não foi possível salvar. Confira o pacote e as impressões digitais e tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Este é o app Android do clube (Trusted Web Activity). Para o Android abrir o site dentro
          do app, o domínio precisa publicar o arquivo <code className="font-mono">/.well-known/assetlinks.json</code>
          {" "}com o pacote e as impressões digitais abaixo. Sem os dois campos preenchidos, o arquivo não é publicado.
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <span className="text-foreground font-medium">Pacote:</span> o identificador do app (applicationId),
            por exemplo <code className="font-mono">com.clube.app</code>. Aparece no Play Console e no campo
            <code className="font-mono"> packageId</code> do <code className="font-mono">twa-manifest.json</code> (Bubblewrap).
          </li>
          <li>
            <span className="text-foreground font-medium">Impressões digitais:</span> SHA-256 dos certificados
            de assinatura, uma por linha. Inclua a chave de assinatura do app e, se existir, a chave de upload.
            Onde pegar: Play Console → Integridade do app → Assinatura de apps (certificado de assinatura e de upload).
            Para uma chave local (Bubblewrap), rode <code className="font-mono">keytool -list -v -keystore seu.keystore</code> e copie o campo SHA256.
          </li>
        </ul>
      </div>

      <div>
        <label htmlFor="androidPackageName" className="text-sm text-muted-foreground mb-1 block">
          Nome do pacote
        </label>
        <input
          id="androidPackageName"
          name="androidPackageName"
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="com.clube.app"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
      </div>

      <div>
        <label htmlFor="androidCertFingerprints" className="text-sm text-muted-foreground mb-1 block">
          Impressões digitais SHA-256 (uma por linha, até 5)
        </label>
        <textarea
          id="androidCertFingerprints"
          name="androidCertFingerprints"
          value={fingerprints}
          onChange={(e) => setFingerprints(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={"AA:BB:CC:...  (32 pares separados por dois-pontos)"}
          className={`${inputClass} font-mono text-xs resize-y`}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Salvando…</>
          ) : saved ? (
            <><Check size={14} /> Salvo!</>
          ) : (
            "Salvar App Android"
          )}
        </button>
        <a
          href="/.well-known/assetlinks.json"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink size={13} /> Abrir /.well-known/assetlinks.json (o que está salvo)
        </a>
      </div>
    </form>
  );
}
