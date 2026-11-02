// ESLint: procura erros comuns no código (variável não usada, nome digitado
// errado, comparação suspeita…). Rodar: npm run lint
// Regras escolhidas à mão (sem plugins), para não precisar de outras dependências.

const browser = [
  "window",
  "document",
  "localStorage",
  "navigator",
  "location",
  "history",
  "fetch",
  "URL",
  "Image",
  "Blob",
  "File",
  "FileReader",
  "confirm",
  "alert",
  "setTimeout",
  "clearTimeout",
  "requestAnimationFrame",
  "getComputedStyle",
  "matchMedia",
  "console",
  "HTMLElement",
  "CSS",
  "Intl",
  "structuredClone",
  "ClipboardItem",
  "self",
  "caches",
  "Response",
  "createImageBitmap",
  "indexedDB",
];
const node = ["require", "module", "process", "__dirname", "Buffer", "console"];
const asGlobals = (list, extra = {}) =>
  Object.assign(Object.fromEntries(list.map((g) => [g, "readonly"])), extra);

const rules = {
  "no-undef": "error",
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-unreachable": "error",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-cond-assign": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-fallthrough": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "no-sparse-arrays": "error",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-shadow-restricted-names": "error",
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: ["error", "smart"],
};

module.exports = [
  {
    ignores: ["data.js", "meta.js", "theme.js", "affinity.js", "node_modules/"],
  },
  {
    files: ["app.js", "logic.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: asGlobals(browser, { module: "readonly", CMLogic: "readonly" }),
    },
    rules,
  },
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: asGlobals(browser),
    },
    rules,
  },
  {
    // testes: o código dentro de page.evaluate roda no navegador
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: asGlobals([...node, ...browser]),
    },
    rules,
  },
];
