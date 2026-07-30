import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "src-tauri/target/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // O React Compiler não está habilitado no FinnacialUX Desktop. As fases
      // consolidadas usam effects para hidratação local, Tauri, SQLCipher e
      // sincronização com APIs nativas; esta regra não deve bloquear o gate.
      "react-hooks/set-state-in-effect": "off",

      // A regra de pureza do React Compiler também não integra o contrato atual.
      // Os comportamentos temporais continuam cobertos pelos testes da aplicação.
      "react-hooks/purity": "off",

      // Parâmetros prefixados com _ representam contratos intencionalmente não usados.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["vendor/**/*.cjs"],
    rules: {
      // A camada minimatch-v3-secure-compat precisa expor a API CommonJS
      // histórica para consumidores antigos. O require() é intencional e fica
      // permitido somente nos adaptadores .cjs dentro de vendor/.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
