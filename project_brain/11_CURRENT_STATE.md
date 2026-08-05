# Estado atual

- Versão: `1.5.0`.
- Schema SQLCipher: `14`, congelado.
- Última fase incorporada: 24, assinatura Windows e distribuição confiável.
- Release local atual: `1.5.0`, `bootstrap-full-installer`.
- Validação automática da release: aprovada no fluxo de recuperação; Authenticode, publisher e timestamp confirmados.
- Homologação manual: pendente para instalações limpas Windows 10 e 11 e demais itens da matriz manual.
- Módulos implementados: finanças pessoais, relatórios, calendário, conciliação, automações, inteligência, planejamento, portabilidade, backup, recuperação, redundância externa, desempenho, rotinas, diagnóstico, onboarding e updater.

Riscos em vigor: não confundir checks automáticos com homologação manual; não perder a chave privada do updater; não alterar migrations congeladas; não versionar artefatos locais. Próximo passo recomendado para a release é executar a matriz manual em ambientes Windows 10 e 11 antes de qualquer publicação como estável.
