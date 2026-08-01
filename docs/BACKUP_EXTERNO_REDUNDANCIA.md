# Backup externo criptografado e redundância real

A Fase 23 adiciona uma segunda localização para pacotes de backup já criptografados.

## Princípios

- somente arquivos `.fuxbackup` criptografados podem ser espelhados automaticamente;
- a chave do Stronghold, senhas e o banco SQLCipher aberto nunca são copiados;
- cada cópia é escrita primeiro em arquivo temporário e renomeada somente após SHA-256 idêntico;
- um sidecar `.sha256` acompanha cada pacote externo;
- a pasta gerenciada é sempre `FinnacialUX-Backups` dentro do destino escolhido;
- retenção remove somente arquivos dessa pasta exclusiva;
- destino no mesmo volume funciona, mas não é classificado como redundância física;
- OneDrive, Dropbox, Google Drive, iCloud, Nextcloud e Syncthing são identificados como pastas sincronizadas.

## Fluxo

1. O backup automático local cria e valida o pacote criptografado.
2. O executor externo seleciona a cópia automática íntegra mais recente.
3. O Rust confirma que a origem pertence à pasta interna de backups.
4. O pacote é copiado atomicamente para a pasta externa.
5. O SHA-256 do destino é comparado ao da origem.
6. O sidecar é gravado e a retenção é aplicada.
7. Verificações futuras detectam mídia desconectada, arquivo alterado ou sidecar ausente.

## Destinos recomendados

- HD ou SSD externo em outro volume;
- pendrive dedicado, conectado durante a janela de backup;
- pasta OneDrive, Dropbox, Google Drive ou Nextcloud sincronizada;
- pasta Syncthing replicada para outro computador.

Uma pasta comum no mesmo disco não protege contra falha física e recebe pontuação reduzida.
