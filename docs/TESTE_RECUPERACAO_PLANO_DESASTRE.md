# Teste de recuperação e plano de desastre

A Fase 22 comprova que uma cópia pode ser aberta, descriptografada e validada sem substituir o banco SQLCipher em uso.

## Ensaio seguro

O executor seleciona preferencialmente o backup automático íntegro mais recente, abre o cabeçalho, resolve a chave do dispositivo pelo Stronghold e usa a pré-visualização nativa. O teste valida checksum, pacote, tabelas obrigatórias, chaves estrangeiras, schema 14 e compatibilidade da aplicação.

Nenhuma chamada de restauração é feita durante o ensaio. O banco atual não é fechado, copiado ou substituído.

## RPO e RTO

- RPO: idade da cópia mais recente considerada recuperável.
- RTO observado: tempo necessário para abrir, descriptografar e validar o pacote no computador atual.

O RTO exibido é uma referência do ensaio, não uma promessa de tempo total para um incidente real.

## Plano de desastre

Uma recuperação real deve bloquear novas gravações, confirmar checksum, criar uma cópia pré-restauração, substituir o banco de forma atômica, validar integridade e exigir novo login.

## Privacidade

O histórico local guarda somente identificadores técnicos, nome do arquivo, schema, versão, duração e resultado. Saldos, lançamentos, anexos, senhas e conteúdo do backup não são copiados para o histórico.
