# minimatch v3 secure compatibility

Pacote local e privado do FinnacialUX Desktop.

Ele preserva a forma de exportação utilizada pelo `minimatch 3.x` (`require("minimatch")` retornando uma função), mas delega todas as operações ao pacote oficial `minimatch 10.2.6`.

A implementação moderna é declarada como dependência do próprio pacote local por meio do alias `minimatch-secure`. Dessa forma, a camada funciona independentemente de o npm posicionar a dependência na raiz ou de forma aninhada.

A camada existe somente enquanto plugins transitivos do ESLint ainda exigirem a API antiga. Ela deve ser removida assim que toda a cadeia migrar oficialmente para `minimatch >= 10.2.6`.
