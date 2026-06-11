import { getAdminConfigRows, getAdminGateways } from "@/app/actions/admin";
import {
  ConfigFormPrices,
  ConfigFormContact,
  ConfigFormGateway,
} from "@/components/admin/ConfigForm";

function getConfigValue(
  rows: { key: string; value: string }[],
  key: string,
  fallback: string
): string {
  return rows.find((r) => r.key === key)?.value ?? fallback;
}

export default async function ConfiguracoesPage() {
  const [configRows, gateways] = await Promise.all([
    getAdminConfigRows(),
    getAdminGateways(),
  ]);

  const inteiraCents = Number(
    getConfigValue(configRows, "ticketPriceInteiraCents", "2000")
  );
  const meiaCents = Number(
    getConfigValue(configRows, "ticketPriceMeiaCents", "1000")
  );
  const whatsapp = getConfigValue(
    configRows,
    "whatsapp",
    "+5567991360075"
  );
  const email = getConfigValue(
    configRows,
    "email",
    "contato@mistoec.com.br"
  );
  const instagram = getConfigValue(
    configRows,
    "instagram",
    "https://www.instagram.com/misto.esporteclube"
  );

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h2 className="font-display text-xl text-foreground tracking-wide">
        CONFIGURAÇÕES
      </h2>

      {/* Preços de Ingressos */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground">
            Preços de Ingressos
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina os preços padrão para ingressos inteira e meia-entrada.
          </p>
        </div>
        <ConfigFormPrices
          inteiraCents={inteiraCents}
          meiaCents={meiaCents}
        />
      </section>

      {/* Dados do Clube */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground">Dados do Clube</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Informações de contato exibidas na plataforma.
          </p>
        </div>
        <ConfigFormContact
          whatsapp={whatsapp}
          email={email}
          instagram={instagram}
        />
      </section>

      {/* Gateway de Pagamento */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground">
            Gateway de Pagamento
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selecione o gateway de pagamento ativo para processar transações.
          </p>
        </div>
        <ConfigFormGateway gateways={gateways} />
      </section>
    </div>
  );
}
