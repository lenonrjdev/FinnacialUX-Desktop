# Visão geral do projeto

O FinnacialUX Desktop é um aplicativo de gestão financeira pessoal para Windows. Ele mantém autenticação, dados financeiros, preferências e recursos operacionais no dispositivo, sem depender de um backend remoto para o funcionamento principal.

- Público: pessoas que desejam administrar finanças pessoais localmente.
- Versão atual: `1.5.0`.
- Schema SQLCipher: `14`, congelado.
- Maturidade: produto desktop funcional com build NSIS, updater e assinatura Windows.
- Capacidades: contas, lançamentos, recebimentos, contas a pagar, cartões, dívidas, orçamentos, metas, relatórios, calendário, conciliação, planejamento, automações, backup, recuperação, diagnóstico e portabilidade.
- Limites atuais: distribuição focada em Windows; a homologação manual da release 1.5.0 ainda depende da matriz de instalação limpa em Windows 10 e 11.

Os objetivos técnicos em vigor são preservar o modelo local-first, manter o banco cifrado e migrável, produzir builds reproduzíveis, impedir vazamento de segredos e exigir validação automatizada antes de qualquer entrega.
