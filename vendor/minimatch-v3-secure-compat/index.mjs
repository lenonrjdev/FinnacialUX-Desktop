import {
  AST,
  GLOBSTAR,
  Minimatch,
  braceExpand,
  defaults,
  escape,
  filter,
  makeRe,
  match,
  minimatch,
  sep,
  unescape,
} from "minimatch-secure";

const legacyDefault = Object.assign(minimatch, {
  minimatch,
  sep,
  GLOBSTAR,
  filter,
  defaults,
  braceExpand,
  makeRe,
  match,
  AST,
  Minimatch,
  escape,
  unescape,
});

export default legacyDefault;
export {
  AST,
  GLOBSTAR,
  Minimatch,
  braceExpand,
  defaults,
  escape,
  filter,
  makeRe,
  match,
  minimatch,
  sep,
  unescape,
};
