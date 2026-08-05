# Checklist estável 1.5.0

- [ ] Windows 10: instalação limpa.
- [ ] Windows 11: instalação limpa.
- [ ] Se o modo for `stable-update`: atualização real da 1.4.0 com dados preservados.
- [ ] Se o modo for `bootstrap-full-installer`: instalador completo validado e nenhum upgrade da 1.4.0 declarado sem evidência.
- [ ] Executável principal com Authenticode válido.
- [ ] Instalador NSIS com Authenticode válido.
- [ ] Publisher exibido corresponde à identidade validada.
- [ ] SHA-256 usado no arquivo e no timestamp.
- [ ] Timestamp RFC 3161 presente nos dois artefatos.
- [ ] Build sem configuração oficial é rejeitado pelo gate de release.
- [ ] Instalador alterado após assinatura é rejeitado.
- [ ] Data de expiração e plano de renovação foram revisados.
- [ ] Assinatura do updater Tauri continua válida.
- [ ] `latest.json` aponta para `desktop-v1.5.0`.
- [ ] Nenhum PFX, senha ou chave privada está no Git ou na pasta da release.
