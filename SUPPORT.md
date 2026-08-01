# Suporte do FinnacialUX Desktop

## Versões atendidas

A versão estável atual recebe correções de segurança, integridade de dados e regressões bloqueadoras. A série estável `1.x` é o canal suportado. A versão `1.3.0` recebe correções de segurança, integridade de dados e regressões bloqueadoras; a `1.2.0` permanece como base de atualização imediatamente anterior.

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


## Ensaio de recuperação

Antes de solicitar suporte sobre restauração, execute Configurações → Teste de recuperação. Compartilhe somente o resultado sanitizado; nunca envie a chave do Stronghold, senha ou arquivo de backup por canais não autorizados.


## Backup externo

Em chamados sobre redundância externa, informe apenas o tipo de destino, disponibilidade e resultado do checksum. Não envie a chave do Stronghold, senhas ou conteúdo dos pacotes. Uma cópia no mesmo volume não substitui mídia externa ou pasta sincronizada.
