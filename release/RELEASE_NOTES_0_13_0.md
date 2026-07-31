# FinnacialUX Desktop 0.13.0

## Conciliação e fechamento financeiro

- importação de extratos CSV e OFX;
- correspondência explicável por valor, data, descrição e conta;
- prévia obrigatória protegida por checksum;
- aplicação atômica com snapshot reversível;
- identificação de duplicidades;
- fechamento mensal por conta e checklist;
- divergência entre saldo calculado e saldo bancário;
- meses fechados protegidos no núcleo Rust;
- reabertura manual com trilha de auditoria;
- comprovantes criptografados no SQLCipher e exportação protegida por SHA-256;
- schema 10 integrado a backup e recuperação;
- nenhuma nova dependência npm ou crate Rust.
