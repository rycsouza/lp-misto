import { motion } from "framer-motion";
import { Check, X, MessageCircle, Leaf, Bird, Shield, Crown, Building2 } from "lucide-react";

const WHATSAPP_NUMBER = "5567991360075";

const plans = [
  {
    name: "Raiz",
    icon: <Leaf size={28} />,
    price: "R$ 9,90",
    period: "/mês",
    highlight: false,
    whatsappMsg: "Olá! Tenho interesse no plano Raiz do Misto Esporte Clube.",
  },
  {
    name: "Torcedor",
    icon: <Shield size={28} />,
    price: "R$ 19,90",
    period: "/mês",
    highlight: false,
    whatsappMsg: "Olá! Tenho interesse no plano Torcedor do Misto Esporte Clube.",
  },
  {
    name: "Carcará",
    icon: <Bird size={28} />,
    price: "R$ 39,90",
    period: "/mês",
    highlight: true,
    whatsappMsg: "Olá! Tenho interesse no plano Carcará do Misto Esporte Clube.",
  },
  {
    name: "Elite",
    icon: <Crown size={28} />,
    price: "R$ 79,90",
    period: "/mês",
    highlight: false,
    whatsappMsg: "Olá! Tenho interesse no plano Elite do Misto Esporte Clube.",
  },
  {
    name: "Empresarial",
    icon: <Building2 size={28} />,
    price: "R$ 199,00",
    period: "/mês",
    highlight: false,
    whatsappMsg: "Olá! Tenho interesse no plano Empresarial do Misto Esporte Clube.",
  },
];

type PlanAccess = "sim" | "não";

interface Benefit {
  label: string;
  access: PlanAccess[];
}

const benefits: Benefit[] = [
  { label: "Carteirinha digital", access: ["sim", "sim", "sim", "sim", "sim"] },
  { label: "Participação em sorteios mensais", access: ["sim", "sim", "sim", "sim", "sim"] },
  { label: "Grupo exclusivo (WhatsApp/Telegram)", access: ["sim", "sim", "sim", "sim", "sim"] },
  
  { label: "Nome no mural digital do clube", access: ["sim", "sim", "sim", "sim", "sim"] },
  { label: "5% desconto em produtos oficiais", access: ["sim", "sim", "sim", "sim", "sim"] },
  { label: "Prioridade 5 na compra de ingressos", access: ["sim", "sim", "sim", "sim", "sim"] },
  { label: "Desconto em ingressos (10% a 20%)", access: ["não", "sim", "sim", "sim", "sim"] },
  { label: "Conteúdos exclusivos (bastidores, vídeos)", access: ["não", "sim", "sim", "sim", "sim"] },
  { label: "10% desconto em produtos", access: ["não", "sim", "sim", "sim", "sim"] },
  { label: "Prioridade 4 na compra de ingressos", access: ["não", "sim", "sim", "sim", "sim"] },
  { label: "1 ingresso gratuito por mês", access: ["não", "não", "sim", "sim", "sim"] },
  { label: "Nome em painel físico no estádio", access: ["não", "não", "sim", "sim", "sim"] },
  { label: "Participação em experiências (treino aberto, visitas)", access: ["não", "não", "sim", "sim", "sim"] },
  { label: "15% desconto em produtos", access: ["não", "não", "sim", "sim", "sim"] },
  { label: "Prioridade 3 na compra de ingressos", access: ["não", "não", "sim", "sim", "sim"] },
  { label: "Camiseta oficial anual", access: ["não", "não", "não", "sim", "sim"] },
  { label: "Área exclusiva no estádio", access: ["não", "não", "não", "sim", "sim"] },
  { label: "Meet & greet com jogadores", access: ["não", "não", "não", "sim", "sim"] },
  { label: "Acesso a eventos do clube", access: ["não", "não", "não", "sim", "sim"] },
  { label: "Prioridade 2 na compra de ingressos", access: ["não", "não", "não", "sim", "sim"] },
  { label: "Divulgação da empresa nas redes do clube", access: ["não", "não", "não", "não", "sim"] },
  { label: "Nome em painel de parceiros", access: ["não", "não", "não", "não", "sim"] },
  { label: "Networking com diretoria", access: ["não", "não", "não", "não", "sim"] },
  { label: "Networking com patrocinadores", access: ["não", "não", "não", "não", "sim"] },
  { label: "Prioridade 1 na compra de ingressos", access: ["não", "não", "não", "não", "sim"] },
];

const MembershipSection = () => (
  <section id="socio" className="py-20 sm:py-28">
    <div className="container mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">SÓCIO TORCEDOR</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Faça parte da história do Misto. Seja sócio e ajude o clube a conquistar o acesso à Série A.
        </p>
      </motion.div>

      {/* Plan Cards - Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:hidden gap-3 mb-8">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className={`bg-card border rounded-xl p-4 flex flex-col items-center text-center ${
              plan.highlight ? "border-primary gold-glow-lg relative" : "border-border"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                POPULAR
              </span>
            )}
            <div className="text-primary mb-2">{plan.icon}</div>
            <h3 className="font-display text-lg tracking-wider text-foreground">{plan.name}</h3>
            <div className="mt-1 mb-3">
              <span className="font-display text-xl text-foreground">{plan.price}</span>
              <span className="text-xs text-muted-foreground">{plan.period}</span>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(plan.whatsappMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-1.5 font-bold py-2 px-4 rounded-lg transition-all text-xs w-full ${
                plan.highlight
                  ? "bg-primary text-primary-foreground hover:bg-primary/80"
                  : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
            >
              <MessageCircle size={14} />
              Seja Sócio
            </a>
          </motion.div>
        ))}
      </div>

      {/* Comparison Table - Desktop */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="hidden lg:block overflow-x-auto mb-12"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-4 text-muted-foreground font-medium text-sm border-b border-border w-[320px]">
                Benefícios
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.name}
                  className={`p-4 text-center border-b ${
                    plan.highlight ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-primary">{plan.icon}</div>
                    <span className="font-display text-lg tracking-wider text-foreground">{plan.name}</span>
                    <div>
                      <span className="font-display text-2xl text-foreground">{plan.price}</span>
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    </div>
                    {plan.highlight && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                        MAIS POPULAR
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benefits.map((benefit, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                <td className="p-3 text-sm text-muted-foreground">{benefit.label}</td>
                {benefit.access.map((val, j) => (
                  <td
                    key={j}
                    className={`p-3 text-center ${plans[j].highlight ? "bg-primary/5" : ""}`}
                  >
                    {val === "sim" ? (
                      <Check size={18} className="text-primary mx-auto" />
                    ) : (
                      <X size={18} className="text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4"></td>
              {plans.map((plan) => (
                <td key={plan.name} className={`p-4 text-center ${plan.highlight ? "bg-primary/5" : ""}`}>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(plan.whatsappMsg)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 font-bold py-2.5 px-5 rounded-lg transition-all text-sm ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/80 gold-glow"
                        : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    <MessageCircle size={16} />
                    Seja Sócio
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </motion.div>

      {/* Mobile Benefits Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="lg:hidden mb-12 overflow-x-auto"
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left p-2 text-muted-foreground font-medium border-b border-border sticky left-0 bg-background min-w-[140px]">
                Benefício
              </th>
              {plans.map((plan) => (
                <th key={plan.name} className={`p-2 text-center border-b border-border min-w-[60px] ${plan.highlight ? "bg-primary/5" : ""}`}>
                  <span className="font-display text-xs tracking-wider text-foreground">{plan.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benefits.map((benefit, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="p-2 text-muted-foreground sticky left-0 bg-background">{benefit.label}</td>
                {benefit.access.map((val, j) => (
                  <td key={j} className={`p-2 text-center ${plans[j].highlight ? "bg-primary/5" : ""}`}>
                    {val === "sim" ? (
                      <Check size={14} className="text-primary mx-auto" />
                    ) : (
                      <X size={14} className="text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Quero ser Sócio Torcedor do Misto Esporte Clube!")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-4 rounded-lg hover:bg-primary/80 transition-all gold-glow text-base"
        >
          <MessageCircle size={18} />
          Seja Sócio Torcedor Agora
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Quero apoiar o Misto Esporte Clube!")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 border-2 border-primary text-primary font-bold px-8 py-4 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all text-base"
        >
          Apoie o Misto
        </a>
      </div>
    </div>
  </section>
);

export default MembershipSection;
