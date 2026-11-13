# Contributing

Thanks for helping improve `vercel-url`. This project uses [Bun](https://bun.sh); run every command from the repository root.

## Install

```bash
bun install --frozen-lockfile
```

This also runs the `prepare` script, which installs the lefthook git hooks.

## Local checks

```bash
bun run lint                            # Biome via ultracite
bun run build:types                     # tsc -p tsconfig.build.json; emits declarations for public entry src/index.ts only
./node_modules/.bin/tsc --noEmit --emitDeclarationOnly false  # full typecheck of all source
bun run build                           # bundles dist/index.js, then runs build:types
bun src/development-regression.ts       # regression checks against src/index.ts
bun src/development-regression.ts --bundle  # same checks against a built bundle
```

There is no `test` script in `package.json`; the two regression commands are the tests. See the README's "Contributing and testing" section for details.

`bun run format` applies lint fixes automatically.

`build` and `build:types` write to `dist/`. Don't commit generated `dist` changes unless the change requires them.
