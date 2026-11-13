# Origem desta skill

- Projeto: cloudflare/security-audit-skill (licença MIT, ver LICENSE)
- Commit fixado: c1c8a8c1471069fb0e188eeaff69b8e8db6564a8 (2026-09-14)
- Copiado sem alterações de `skills/security-audit/`. Revisado antes de entrar no projeto: instruções só
  defensivas (auditoria por código-fonte, sem sondar produção, execução só em sandbox sem rede) e validadores
  Node sem dependências que apenas leem os JSON da auditoria.

## Como usamos neste projeto

- Prevenção continua em `docs/CLAUDE_SECURITY_RULES.md` e na skill `security`; esta skill é a auditoria periódica.
- Rodar por área (ex.: pagamentos e webhooks), perfil `quick` ou `standard`, com orçamento de agentes.
- Saída SEMPRE fora do repositório (`~/security-audit-skill/lp-misto/run-N`): achados são informação crítica.
  Nunca enviar achados para buscas na web nem publicá-los.
- Achados confirmados viram correção + teste de regressão, classificados como Grave, Médio ou Moderado.

## Atualizar

Revisar o diff do upstream antes de trocar o commit fixado acima. Não usar `npx skills add` direto.
