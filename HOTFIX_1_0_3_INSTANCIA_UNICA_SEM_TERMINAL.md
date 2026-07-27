# Hotfix 1.0.3 — Instância única e aplicativo sem terminal

## Correções

- remove a janela de console do executável de produção no Windows;
- mantém o terminal apenas em `tauri dev`, onde ele é necessário para logs;
- impede que duas ou mais instâncias do FinnacialUX Desktop permaneçam abertas;
- ao abrir novamente, restaura e focaliza a janela já existente;
- impede execuções duplicadas do script de desenvolvimento;
- identifica conflito da porta 3000 antes de iniciar outro Next.js.

## Aplicação

Extraia o ZIP na raiz do FinnacialUX Desktop e substitua os arquivos.

Depois valide:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\01_CONFIGURAR_DESKTOP.cmd
```

Para desenvolvimento:

```powershell
.\02_RODAR_DESKTOP.cmd
```

O terminal permanece aberto somente nesse modo.

Para gerar o instalador sem terminal:

```powershell
.\03_GERAR_INSTALADOR.cmd
```

Instale novamente o arquivo gerado em:

```text
src-tauri\target\release\bundle\nsis\
```

O aplicativo instalado não abre terminal e aceita somente uma instância.

A versão do aplicativo foi elevada para `0.1.1`, mantendo o mesmo identificador, para que o novo instalador seja reconhecido como atualização do teste anterior.
