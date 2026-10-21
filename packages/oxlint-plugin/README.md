# @packages/oxlint-plugin

Project-specific oxlint setup: a JS plugin (an alpha oxlint feature) with rules under the
`supa` namespace, plus the shared lint config that enables them.

The root `.oxlintrc.json` extends it:

```json
{ "extends": ["./packages/oxlint-plugin/recommended.json"] }
```

`recommended.json` loads the plugin and holds all project rules. Its `files` globs
(`app/src/pages/**` and so on) are resolved from the repository root, so run oxlint from
there. General settings (`no-unused-vars`, `no-console`, `ignorePatterns`) stay in the
root config.

## Rules

- `supa/no-import-meta-env-outside-config`: `import.meta.env` may only be read in
  `app/src/lib/config.ts`. Everything else uses `config`.
- Built-in `no-restricted-imports`, configured in `recommended.json`:
  - Pages, `lib/shell/` and `main.ts` must not import the Supabase, PowerSync or router
    packages at runtime.
  - Infrastructure modules (`AuthService`, `AuthController`, `authGuard`, the connector,
    `syncLifecycle`, `SyncController`, `sync/client.ts`) may only be imported at runtime
    by `platform.ts` and tests.
  - Type-only imports are always allowed.
