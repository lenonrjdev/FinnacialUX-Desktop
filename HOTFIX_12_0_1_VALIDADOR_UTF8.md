# Hotfix 12.0.1 — Validador UTF-8 da Fase 12

## Problema corrigido

A suíte técnica da versão 0.12.0 era concluída com sucesso, mas o verificador final falhava ao procurar a expressão `margem flexível` no arquivo de testes.

O Windows PowerShell 5.1 pode interpretar arquivos UTF-8 sem BOM usando a página de código local quando `Get-Content` é chamado sem codificação explícita. Assim, textos acentuados podiam ser lidos de forma diferente mesmo quando o teste correspondente existia e havia passado.

## Correção

- adiciona leitura explícita em UTF-8 com `System.IO.File::ReadAllText`;
- valida a margem flexível pelo contrato estrutural `monthlyFlexible`;
- valida a distribuição total por `toBe(100)`;
- valida revisão, avalanche e checksum por identificadores reais do código;
- substitui verificações textuais frágeis por contratos estruturais;
- mantém a suíte completa de qualidade e segurança antes da checagem final.

## Escopo

Nenhuma lógica financeira, migration, interface, comando Tauri, dependência ou versão foi alterada. A aplicação permanece em `0.12.0` com schema 9.
