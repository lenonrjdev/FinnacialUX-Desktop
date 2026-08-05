# Estado atual

- Versão: `1.5.0`.
- Schema SQLCipher: `14`, congelado.
- Última fase incorporada: 24, assinatura Windows e distribuição confiável.
- Comandos operacionais: quatro entrypoints na raiz, com implementações organizadas por responsabilidade em `scripts/`.
- Release local atual: `1.5.0`, `bootstrap-full-installer`.
- Validação automática: qualidade, artefatos, Authenticode, publisher e timestamp aprovados na última execução registrada.
- Homologação manual: pendente para instalações limpas Windows 10/11 e demais itens da matriz real.
- Módulos implementados: finanças pessoais, relatórios, calendário, conciliação, automações, inteligência, planejamento, portabilidade, backup, recuperação, redundância externa, desempenho, rotinas, diagnóstico, onboarding e updater.

Riscos em vigor: não confundir checks automáticos com homologação manual; não perder nem regenerar a chave privada do updater; não alterar migrations congeladas; não versionar artefatos locais; não acoplar preparação e publicação. Próximo passo da release continua sendo executar a matriz manual real antes de `04_PUBLICAR_ATUALIZACAO.cmd`.
