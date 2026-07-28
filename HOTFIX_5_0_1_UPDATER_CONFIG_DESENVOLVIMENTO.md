# Hotfix 5.0.1 — configuração segura do updater no desenvolvimento

## Problema corrigido

O plugin `tauri-plugin-updater` era registrado durante a inicialização do aplicativo, mas a configuração base não continha um objeto `plugins.updater` enquanto o canal de releases ainda não havia sido configurado.

Sem esse objeto, o Tauri entregava `null` ao desserializador do plugin e encerrava o aplicativo com:

```text
invalid type: null, expected struct Config
```

## Correção

A configuração base agora contém um objeto de updater válido, porém inativo:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "",
      "endpoints": [],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

Isso permite que o plugin seja inicializado no modo de desenvolvimento sem tentar consultar um servidor.

Quando `04_CONFIGURAR_ATUALIZACOES.cmd` for executado, o arquivo `src-tauri/tauri.updater.conf.json` continuará substituindo os campos vazios durante os builds de release assinados.

## Segurança e dados

Este hotfix não altera:

- banco SQLCipher;
- migrations;
- chaves do Stronghold;
- backups;
- dados financeiros;
- versão do aplicativo.
