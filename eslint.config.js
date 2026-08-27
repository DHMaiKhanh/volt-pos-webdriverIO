import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import wdio from 'eslint-plugin-wdio';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'reports/**', 'logs/**', '.tmp/**', '.drivers/**', 'allure-*/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // WDIO's `$`/`$$` return ChainablePromise objects. The plugin catches the
    // classic mistake of forgetting `await` on a command, which silently passes.
    //
    // `plugins` comes from the plugin's OWN flat config, not from the module
    // namespace. `eslint-plugin-wdio` exports its rules pre-namespaced
    // (`rules['wdio/no-debug']`), which is the eslintrc shape; flat config
    // resolves `wdio/no-debug` to plugin `wdio` + rule `no-debug` and finds
    // nothing, so `plugins: { wdio }` fails the whole run with
    // `Could not find "no-debug" in plugin "wdio"`. The `flat/recommended`
    // entry ships a correctly de-namespaced copy for exactly this reason.
    files: ['tests/**/*.ts', 'src/pages/**/*.ts', 'src/components/**/*.ts', 'src/flows/**/*.ts'],
    plugins: wdio.configs['flat/recommended'].plugins,
    rules: {
      ...wdio.configs['flat/recommended'].rules,
    },
  },
  {
    // Unit tests run on `node:test`, not on WebdriverIO's Mocha.
    //
    // Two consequences. First, `describe`/`it` from `node:test` RETURN a promise
    // that the runner owns and the caller is not meant to await, so the
    // floating-promise rules fire on every single test — a false positive, and a
    // loud one. Second, the wdio plugin's rules are scoped to `tests/**` above
    // and have nothing to say here: there is no browser in this lane.
    //
    // Deliberately narrow: `tests/unit/**` only. Everything under `tests/smoke`
    // and `tests/regression` drives a real session and keeps both rules, because
    // there a missing `await` on a command silently passes.
    files: ['tests/unit/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      'wdio/no-floating-promise': 'off',
    },
  },
  {
    // Scripts are operator tooling: their console output IS the product. So is
    // the run banner `onPrepare` prints and the report path `onComplete` leaves
    // behind — both are read off the terminal before winston has a file to tail.
    files: ['scripts/**/*.ts', 'configs/wdio/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // This config file itself, and any other plain JS. `projectService` only
    // knows the files tsconfig.json includes, so type-aware rules cannot run
    // here — leaving them on fails the lint with a parsing error rather than a
    // finding.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
