"use client";

import { useState, useTransition } from "react";
import { submitAthleteApplication } from "@/app/actions/athletes";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

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

function formatWhatsApp(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCPF(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function AthleteApplicationForm({ hasInviteCode }: { hasInviteCode: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [salaryBrl, setSalaryBrl] = useState("");
  const [hp, setHp] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitAthleteApplication({
        inviteCode,
        fullName,
        whatsapp: whatsapp.replace(/\D/g, ""),
        email,
        cpf,
        rg,
        birthDate,
        city,
        state,
        nickname: nickname || undefined,
        position,
        dominantFoot,
        weightKg,
        heightCm,
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

      {/* Invite code */}
      {hasInviteCode && (
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <label className="block text-sm font-medium text-foreground mb-1">
            Código de acesso *
          </label>
          <input
            required
            className={inputClass}
            placeholder="Digite o código fornecido pelo clube"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Solicite o código ao departamento de futebol do Misto EC.
          </p>
        </div>
      )}

      {/* Section: Dados Pessoais */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
          Dados Pessoais
        </h3>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome Completo *</label>
          <input required className={inputClass} placeholder="João da Silva" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">WhatsApp *</label>
            <input required className={inputClass} placeholder="(67) 99999-0000" value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">E-mail *</label>
            <input required type="email" className={inputClass} placeholder="joao@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CPF *</label>
            <input required className={inputClass} placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} maxLength={14} inputMode="numeric" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">RG *</label>
            <input required className={inputClass} placeholder="0000000" value={rg} onChange={(e) => setRg(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Data de Nascimento *</label>
          <input required type="date" className={inputClass} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Cidade de Origem *</label>
            <input required className={inputClass} placeholder="Três Lagoas" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Estado *</label>
            <select required className={selectClass} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">UF</option>
              {STATES.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section: Dados Esportivos */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
          Dados Esportivos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Apelido</label>
            <input className={inputClass} placeholder="Joãozinho" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Posição em Campo *</label>
            <select required className={selectClass} value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">Selecione</option>
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Pé Dominante *</label>
            <select required className={selectClass} value={dominantFoot} onChange={(e) => setDominantFoot(e.target.value)}>
              <option value="">Selecione</option>
              <option value="direito">Direito</option>
              <option value="esquerdo">Esquerdo</option>
              <option value="ambidestro">Ambidestro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Peso (kg) *</label>
            <input required className={inputClass} placeholder="75" value={weightKg} onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Altura (cm) *</label>
            <input required className={inputClass} placeholder="178" value={heightCm} onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} />
          </div>
        </div>
      </section>

      {/* Section: Dados Contratuais */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
          Dados Contratuais
        </h3>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Chave PIX para Pagamentos</label>
          <input className={inputClass} placeholder="CPF, e-mail ou telefone" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Data de Início do Contrato</label>
            <input type="date" className={inputClass} value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Salário (R$)</label>
            <input className={inputClass} placeholder="0,00" value={salaryBrl} onChange={(e) => setSalaryBrl(e.target.value)} inputMode="decimal" />
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
