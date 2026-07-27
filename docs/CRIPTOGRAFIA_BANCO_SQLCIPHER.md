# Operação do banco SQLCipher

## Onde fica o banco

O arquivo continua na pasta de configuração do FinnacialUX, mas deixa de ser um
SQLite legível por ferramentas comuns. Não mova apenas o arquivo `.db` para outro
computador: a chave pertence ao Stronghold daquela instalação.

## Transferência entre computadores

Use um backup `.fuxbackup` com **senha portátil**. Esse é o fluxo suportado para
mudar de computador, recuperar o perfil do Windows ou manter uma cópia externa.

## Rotação de chave

A opção Configurações → Segurança → Rotacionar chave:

1. confirma a senha principal;
2. prepara uma nova chave no Stronghold;
3. cria uma cópia técnica do banco criptografado;
4. executa `PRAGMA rekey`;
5. testa a nova chave;
6. promove a chave pendente para ativa.

Não desligue o computador durante a rotação. Se houver interrupção, a próxima
abertura tenta as chaves ativa, pendente e anterior para recuperar o banco.

## Diagnóstico

O pacote de diagnóstico registra apenas:

- versão do SQLCipher;
- versão do schema;
- tamanho do banco;
- impressão digital curta da chave;
- datas de ativação e rotação.

A chave real e o conteúdo financeiro não são exportados.

## Limites

A criptografia protege os dados em repouso. Enquanto o usuário estiver autenticado
e o aplicativo desbloqueado, os dados necessários à tela existem temporariamente
na memória. Use bloqueio automático, senha do Windows e disco protegido por
BitLocker quando disponível.
