# Suporte do FinnacialUX Desktop

## Versões atendidas

A versão estável atual recebe correções de segurança, integridade de dados e regressões bloqueadoras. Durante o ciclo inicial, a série `1.0.x` é o canal suportado.

## Antes de solicitar suporte

1. abra **Configurações → Diagnóstico**;
2. execute a auditoria local;
3. aplique somente os reparos recomendados pelo aplicativo;
4. gere um pacote `.fuxsupport`;
5. anote a versão, o horário aproximado e os passos que reproduzem o problema.

## Dados que podem ser enviados

O pacote de suporte foi projetado para conter somente informações técnicas sanitizadas. Revise o arquivo antes de compartilhar.

Não envie:

- senha, PIN ou chave de recuperação;
- arquivos do Stronghold;
- banco SQLCipher;
- backups completos;
- extratos bancários;
- tokens, chaves privadas ou credenciais do updater.

## Prioridades

- **Crítica:** risco de perda de dados, falha de criptografia ou atualização impossível;
- **Alta:** aplicativo não inicia ou função principal fica indisponível;
- **Normal:** comportamento incorreto com alternativa disponível;
- **Baixa:** melhoria visual, texto ou conveniência.

## Ciclo de correções

Correções são publicadas com versionamento semântico. Atualizações que envolvam o banco devem preservar compatibilidade, possuir teste de upgrade e manter backup pré-atualização.
