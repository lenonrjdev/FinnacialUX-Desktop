# Segurança — FinnacialUX Desktop

## Relato responsável

Não publique chaves, bancos, backups ou dados financeiros em issues públicas. Relatos devem incluir apenas a versão, o sistema operacional, passos de reprodução e um pacote `.fuxsupport` sanitizado quando necessário.

## Proteções do produto

- banco SQLCipher;
- chaves no Stronghold;
- Argon2 para credenciais locais;
- backups criptografados;
- assinatura do updater;
- checksum SHA-256 dos artefatos;
- modo somente leitura em falhas de integridade;
- snapshots antes de operações sensíveis;
- logs e pacotes de suporte sanitizados.

## Release Candidate

A versão `0.18.0-rc.1` deve ser publicada como pré-release. O schema 14 está congelado e qualquer mudança nas migrations invalida a homologação.

## Segredos

Nunca envie para o repositório:

- chave privada do updater;
- senha da chave privada;
- certificados com chave privada;
- arquivos `.fuxbackup`, `.fuxsupport` ou bancos reais;
- diretório `.release` local;
- conteúdo do Stronghold.

## Assinatura de código do Windows

Releases estáveis a partir da 1.5.0 exigem Authenticode válido no executável e no instalador, SHA-256 e timestamp. Certificados privados, PFX e senhas não podem entrar no repositório nem na pasta pública da release.
