# FinnacialUX Desktop 0.18.0-rc.1

Primeira versão candidata à estabilidade 1.0 do FinnacialUX Desktop.

## O que está sendo homologado

- instalação NSIS para Windows x64;
- atualização preservando o banco SQLCipher e os dados locais;
- schema 14 congelado;
- assinatura do updater e SHA-256 dos artefatos;
- backup criptografado antes de atualizar;
- recuperação após atualização interrompida;
- rotinas locais, notificações, bandeja e bloqueio;
- importação, portabilidade, conciliação, planejamento e diagnóstico;
- comportamento em Windows 10 e Windows 11.

## Segurança e privacidade

A aplicação continua offline-first. Não há telemetria externa. Conexões de rede acontecem apenas quando o usuário configura/verifica atualizações ou acessa um recurso externo explicitamente.

## Atenção

Esta é uma pré-release. Ela não deve ser marcada como a versão estável mais recente e não encerra o ciclo de homologação. O instalador só deve ser promovido a `1.0.0` depois que todos os itens do checklist manual forem aprovados.

## Compatibilidade

- versão do aplicativo: `0.18.0-rc.1`;
- schema SQLCipher: `14`;
- canal: `release-candidate`;
- destino: Windows x64, instalador NSIS;
- atualização suportada a partir da base validada `0.17.0` e dos schemas históricos cobertos pela suíte nativa.
