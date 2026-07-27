# Fase 4 — Banco local criptografado com SQLCipher

Versão: `0.4.0`

Esta fase protege o arquivo principal do FinnacialUX Desktop com SQLCipher. A
chave de 256 bits é criada no primeiro uso e armazenada no Stronghold; o segredo
que abre o cofre permanece no Gerenciador de Credenciais do Windows.

## Entregas

- substituição do plugin SQL genérico por uma ponte nativa controlada;
- SQLCipher compilado junto ao aplicativo;
- migração automática do SQLite sem criptografia para SQLCipher;
- cópia técnica protegida antes da primeira conversão;
- chave mantida apenas em memória enquanto o banco está desbloqueado;
- remoção da chave da memória ao sair ou bloquear o aplicativo;
- recuperação automática após interrupção durante a rotação de chave;
- rotação manual da chave em Configurações → Segurança;
- diagnósticos com versão do cipher, schema e impressão digital não reversível;
- backups e restaurações compatíveis com as fases anteriores;
- migration `0004_database_encryption.sql`.

## Primeira abertura após a atualização

Quando `finnacialux.db` ainda for um SQLite comum, o aplicativo:

1. cria ou recupera a chave no Stronghold;
2. conclui o checkpoint do WAL;
3. cria uma cópia técnica `.fuxlegacy` protegida com AES-256-GCM;
4. exporta todas as tabelas para um banco SQLCipher temporário;
5. valida a nova chave e o conteúdo;
6. troca os arquivos de forma reversível;
7. aplica a migration 0004;
8. remove o arquivo temporário anterior somente após a validação final.

Nenhum reset, seed ou novo cadastro é necessário.

## Chave do banco

A chave completa nunca é exibida. A interface mostra somente uma impressão
digital curta, usada para diagnóstico e comparação. A rotação usa três posições
no Stronghold — ativa, pendente e anterior — para recuperar o acesso caso o
processo seja interrompido entre a alteração do SQLCipher e a gravação do cofre.

## Backups

O banco permanece criptografado em disco. Para criar um `.fuxbackup`, o processo
nativo gera uma fotografia SQLite temporária consistente, empacota e criptografa
o backup conforme o modo escolhido e apaga o arquivo temporário ao final.

Backups antigos das fases 2 e 3 continuam reconhecidos. Ao restaurá-los, o
conteúdo é convertido novamente para SQLCipher antes de substituir o banco ativo.

## Pré-requisitos adicionais de compilação no Windows

Além do Node.js, Rust e Visual Studio Build Tools com C++, a compilação local do
SQLCipher com OpenSSL incorporado exige Perl. O script de configuração verifica:

```powershell
winget install --id StrawberryPerl.StrawberryPerl
```

NASM é recomendado para otimizações do OpenSSL:

```powershell
winget install --id NASM.NASM
```

Depois de instalar ferramentas nativas, feche e reabra o PowerShell.

## Validação

```powershell
.\01_CONFIGURAR_DESKTOP.cmd
.\02_RODAR_DESKTOP.cmd
```

Em seguida, abra Configurações → Segurança e confirme:

- Criptografia integral ativa;
- SQLCipher identificado;
- schema 4;
- impressão digital da chave preenchida.

Depois crie um backup portátil, feche o aplicativo, abra novamente e valide a
persistência. A cópia portátil é indispensável porque a perda do perfil do
Windows e do Stronghold pode tornar o banco local inacessível.
