"use strict";

const modern = require("minimatch-secure");
const minimatch = modern.minimatch;

if (typeof minimatch !== "function") {
  throw new TypeError("minimatch-secure não expôs a função minimatch esperada.");
}

// O minimatch 3 exportava diretamente uma função CommonJS. Os plugins antigos
// do ESLint ainda esperam essa forma. As propriedades abaixo preservam essa API
// enquanto toda a implementação é delegada ao minimatch moderno e corrigido.
minimatch.minimatch = minimatch;
minimatch.sep = modern.sep;
minimatch.GLOBSTAR = modern.GLOBSTAR;
minimatch.filter = modern.filter;
minimatch.defaults = modern.defaults;
minimatch.braceExpand = modern.braceExpand;
minimatch.makeRe = modern.makeRe;
minimatch.match = modern.match;
minimatch.AST = modern.AST;
minimatch.Minimatch = modern.Minimatch;
minimatch.escape = modern.escape;
minimatch.unescape = modern.unescape;

module.exports = minimatch;
module.exports.minimatch = minimatch;
module.exports.sep = modern.sep;
module.exports.GLOBSTAR = modern.GLOBSTAR;
module.exports.filter = modern.filter;
module.exports.defaults = modern.defaults;
module.exports.braceExpand = modern.braceExpand;
module.exports.makeRe = modern.makeRe;
module.exports.match = modern.match;
module.exports.AST = modern.AST;
module.exports.Minimatch = modern.Minimatch;
module.exports.escape = modern.escape;
module.exports.unescape = modern.unescape;
