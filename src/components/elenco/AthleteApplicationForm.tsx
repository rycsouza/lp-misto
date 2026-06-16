"use client";

import { useState, useTransition, useRef } from "react";
import { submitAthleteApplication, verifyAthleteInviteCode } from "@/app/actions/athletes";
import {
  CheckCircle2, Loader2, AlertCircle, Lock, Camera, X, User,
} from "lucide-react";
import Image from "next/image";

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: "goleiro", label: "Goleiro" },
  { value: "zagueiro", label: "Zagueiro" },
  { value: "lateral", label: "Lateral" },
  { value: "volante", label: "Volante" },
  { value: "meia", label: "Meia" },
  { value: "atacante", label: "Atacante" },
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const inputClass =
  "w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

const selectClass =
  "w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";

// ─── Formatters / Validators ─────────────────────────────────────────────────

function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function fmtCPF(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtDate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function fmtRG(raw: string): string {
  // Accept digits + X (CIN check digit can be X); mask: XX.XXX.XXX-D
  const v = raw.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 9);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}-${v.slice(8)}`;
}

function fmtSalary(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDateBR(str: string): string | null {
  const [day, month, year] = str.split("/");
  if (!day || !month || !year || year.length !== 4) return null;
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +d[10];
}

// ─── Invite Code Gate ─────────────────────────────────────────────────────────

function InviteCodeGate({ onUnlocked }: { onUnlocked: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError("Digite o código de acesso."); return; }
    setError("");
    startTransition(async () => {
      const { valid } = await verifyAthleteInviteCode(code);
      if (valid) {
        onUnlocked(code);
      } else {
        setError("Código inválido. Solicite ao departamento de futebol do Misto EC.");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock size={24} className="text-primary" />
      </div>
      <div>
        <h2 className="font-semibold text-foreground mb-1">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Insira o código fornecido pelo departamento de futebol para acessar o formulário.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          autoFocus
          className={inputClass + " text-center tracking-widest font-mono text-base"}
          placeholder="CÓDIGO"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
        />
        {error && (
          <p className="text-destructive text-xs flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Acessar formulário
        </button>
      </form>
    </div>
  );
}

// ─── Photo Upload ─────────────────────────────────────────────────────────────

function PhotoUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError("");
    if (!file.type.startsWith("image/")) {
      setUploadError("Apenas imagens são aceitas.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Imagem deve ter no máximo 5MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/athlete", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) onChange(json.url);
      else setUploadError(json.error ?? "Erro ao enviar foto.");
    } catch {
      setUploadError("Erro de conexão ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors overflow-hidden flex items-center justify-center bg-secondary/30"
      >
        {value ? (
          <Image src={value} alt="Foto" fill className="object-cover" unoptimized />
        ) : uploading ? (
          <Loader2 size={24} className="text-muted-foreground animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <User size={28} />
            <Camera size={14} />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary underline underline-offset-2 disabled:opacity-40"
        >
          {value ? "Trocar foto" : "Adicionar foto"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-destructive flex items-center gap-0.5"
          >
            <X size={12} /> Remover
          </button>
        )}
      </div>

      {uploadError && (
        <p className="text-destructive text-xs flex items-center gap-1">
          <AlertCircle size={12} /> {uploadError}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Foto opcional · máx. 5MB</p>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

function ApplicationForm({ inviteCode }: { inviteCode: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [photoUrl, setPhotoUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [stateUF, setStateUF] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [salaryBrl, setSalaryBrl] = useState("");
  const [hp, setHp] = useState("");

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 3) errs.fullName = "Nome muito curto";
    if (whatsapp.replace(/\D/g, "").length < 10) errs.whatsapp = "WhatsApp inválido";
    if (!email.includes("@")) errs.email = "E-mail inválido";
    if (!validateCPF(cpf)) errs.cpf = "CPF inválido";
    if (rg.replace(/[^0-9X]/gi, "").length < 5) errs.rg = "RG inválido (mínimo 5 dígitos)";
    if (!parseDateBR(birthDate)) errs.birthDate = "Data inválida (DD/MM/AAAA)";
    if (!city.trim()) errs.city = "Cidade obrigatória";
    if (!stateUF) errs.state = "Estado obrigatório";
    if (!position) errs.position = "Posição obrigatória";
    if (!dominantFoot) errs.dominantFoot = "Pé dominante obrigatório";
    if (!weightKg || Number(weightKg) < 30 || Number(weightKg) > 200) errs.weightKg = "Peso inválido";
    if (!heightCm || Number(heightCm) < 100 || Number(heightCm) > 250) errs.heightCm = "Altura inválida";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    const isoDate = parseDateBR(birthDate)!;

    startTransition(async () => {
      const result = await submitAthleteApplication({
        inviteCode,
        fullName: fullName.trim(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        email,
        cpf,
        rg,
        birthDate: isoDate,
        city,
        state: stateUF,
        nickname: nickname || undefined,
        position,
        dominantFoot,
        weightKg,
        heightCm,
        photoUrl: photoUrl || undefined,
        pixKey: pixKey || undefined,
        contractStart: contractStart || undefined,
        salaryBrl: salaryBrl || undefined,
        _hp: hp,
      });

      if (!result.success) {
        setError(result.error ?? "Erro ao enviar cadastro.");
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-primary" />
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
            Cadastro enviado!
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Sua ficha foi recebida e será analisada pela comissão técnica. Aguarde o contato da diretoria.
          </p>
        </div>
      </div>
    );
  }

  function err(field: string) {
    return fieldErrors[field] ? (
      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
        <AlertCircle size={11} /> {fieldErrors[field]}
      </p>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Honeypot */}
      <input
        type="text"
        name="_hp"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Photo */}
      <div className="flex justify-center">
        <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />
      </div>

      {/* Section: Dados Pessoais */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-xs uppercase tracking-widest text-primary">
          Dados Pessoais
        </h3>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome Completo *</label>
          <input
            className={inputClass}
            placeholder="João da Silva"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setFieldErrors((p) => ({ ...p, fullName: "" })); }}
          />
          {err("fullName")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">WhatsApp *</label>
            <input
              className={inputClass}
              placeholder="(67) 99999-0000"
              value={whatsapp}
              inputMode="numeric"
              onChange={(e) => { setWhatsapp(fmtPhone(e.target.value)); setFieldErrors((p) => ({ ...p, whatsapp: "" })); }}
            />
            {err("whatsapp")}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">E-mail *</label>
            <input
              type="email"
              className={inputClass}
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
            />
            {err("email")}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CPF *</label>
            <input
              className={inputClass}
              placeholder="000.000.000-00"
              value={cpf}
              inputMode="numeric"
              maxLength={14}
              onChange={(e) => { setCpf(fmtCPF(e.target.value)); setFieldErrors((p) => ({ ...p, cpf: "" })); }}
            />
            {err("cpf")}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">RG / CIN *</label>
            <input
              className={inputClass}
              placeholder="00.000.000-0"
              value={rg}
              inputMode="numeric"
              maxLength={12}
              onChange={(e) => { setRg(fmtRG(e.target.value)); setFieldErrors((p) => ({ ...p, rg: "" })); }}
            />
            {err("rg")}
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Data de Nascimento *</label>
          <input
            className={inputClass}
            placeholder="DD/MM/AAAA"
            value={birthDate}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => { setBirthDate(fmtDate(e.target.value)); setFieldErrors((p) => ({ ...p, birthDate: "" })); }}
          />
          {err("birthDate")}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Cidade de Origem *</label>
            <input
              className={inputClass}
              placeholder="Três Lagoas"
              value={city}
              onChange={(e) => { setCity(e.target.value); setFieldErrors((p) => ({ ...p, city: "" })); }}
            />
            {err("city")}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Estado *</label>
            <select
              className={selectClass}
              value={stateUF}
              onChange={(e) => { setStateUF(e.target.value); setFieldErrors((p) => ({ ...p, state: "" })); }}
            >
              <option value="">UF</option>
              {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            {err("state")}
          </div>
        </div>
      </section>

      {/* Section: Dados Esportivos */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-xs uppercase tracking-widest text-primary">
          Dados Esportivos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Apelido</label>
            <input
              className={inputClass}
              placeholder="Joãozinho"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Posição em Campo *</label>
            <select
              className={selectClass}
              value={position}
              onChange={(e) => { setPosition(e.target.value); setFieldErrors((p) => ({ ...p, position: "" })); }}
            >
              <option value="">Selecione</option>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {err("position")}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Pé Dominante *</label>
            <select
              className={selectClass}
              value={dominantFoot}
              onChange={(e) => { setDominantFoot(e.target.value); setFieldErrors((p) => ({ ...p, dominantFoot: "" })); }}
            >
              <option value="">Selecione</option>
              <option value="direito">Direito</option>
              <option value="esquerdo">Esquerdo</option>
              <option value="ambidestro">Ambidestro</option>
            </select>
            {err("dominantFoot")}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Peso (kg) *</label>
            <input
              className={inputClass}
              placeholder="75"
              value={weightKg}
              inputMode="numeric"
              maxLength={3}
              onChange={(e) => { setWeightKg(e.target.value.replace(/\D/g, "")); setFieldErrors((p) => ({ ...p, weightKg: "" })); }}
            />
            {err("weightKg")}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Altura (cm) *</label>
            <input
              className={inputClass}
              placeholder="178"
              value={heightCm}
              inputMode="numeric"
              maxLength={3}
              onChange={(e) => { setHeightCm(e.target.value.replace(/\D/g, "")); setFieldErrors((p) => ({ ...p, heightCm: "" })); }}
            />
            {err("heightCm")}
          </div>
        </div>
      </section>

      {/* Section: Dados Contratuais */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-xs uppercase tracking-widest text-primary">
          Dados Contratuais
        </h3>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Chave PIX para Pagamentos</label>
          <input
            className={inputClass}
            placeholder="CPF, e-mail ou telefone"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Início do Contrato</label>
            <input
              className={inputClass}
              placeholder="DD/MM/AAAA"
              value={contractStart}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => setContractStart(fmtDate(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Salário</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                R$
              </span>
              <input
                className={inputClass + " pl-9"}
                placeholder="0,00"
                value={salaryBrl}
                inputMode="numeric"
                onChange={(e) => setSalaryBrl(fmtSalary(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Enviando ficha...</>
        ) : (
          "Enviar Ficha de Cadastro"
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Seus dados serão tratados com sigilo e usados exclusivamente pelo Misto EC.
      </p>
    </form>
  );
}

// ─── Exported Component ───────────────────────────────────────────────────────

export function AthleteApplicationForm({ hasInviteCode }: { hasInviteCode: boolean }) {
  const [unlockedCode, setUnlockedCode] = useState<string | null>(
    hasInviteCode ? null : ""
  );

  if (unlockedCode === null) {
    return <InviteCodeGate onUnlocked={setUnlockedCode} />;
  }

  return <ApplicationForm inviteCode={unlockedCode} />;
}
