# styles

Refactor project styles from the command line

## Install

From the repository root, install globally from the local folder (not published to npm):

```
npm install -g ./packages/styles-cli
```

The install links to the monorepo folder, so `styles` always runs against the current project. Re-run the command only if the package folder is moved.

```
USAGE
  styles <command> <subcommand> [flags]

COMMANDS
  report:             Report violations (not in the baseline)
  theme-candidates:   Find candidates for design system tokens
  to-css:             Compile Tailwind utilities into CSS for a custom class

EXAMPLES
  $ styles report
  $ styles report --update-baseline
  $ styles theme-candidates
  $ styles theme-candidates --json
  $ styles to-css my-card "p-2 text-sm"

COMMON FLAGS
  --help      Show help for command
  --version   Show styles version
```
