import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ROOT } from "./root.js";
import * as report from "./commands/report.js";
import * as themeCandidates from "./commands/theme-candidates.js";
import * as toCss from "./commands/to-css.js";

const commands = [report, themeCandidates, toCss];

const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

const isHelp = (arg) => arg === "--help" || arg === "-h";

function helpText() {
  const width = Math.max(...commands.map((c) => c.name.length));
  const lines = commands.map((c) => `  ${c.name.padEnd(width)}   ${c.summary}`);
  return [
    "USAGE",
    "  styles <command> [flags]",
    "",
    "COMMANDS",
    ...lines,
    "",
    "COMMON FLAGS",
    "  --help, -h   Show help for command",
    "  --version    Show styles version",
  ].join("\n");
}

/**
 * Runs the CLI with the given arguments (without the node binary and script path).
 * @returns {Promise<number>} The process exit code.
 */
export async function run(argv) {
  const [name, ...rest] = argv;

  if (!name || isHelp(name)) {
    console.log(helpText());
    return 0;
  }
  if (name === "--version") {
    console.log(version);
    return 0;
  }

  const command = commands.find((c) => c.name === name);
  if (!command) {
    console.error(`styles: unknown command "${name}"\n\n${helpText()}`);
    return 2;
  }
  if (rest.some(isHelp)) {
    console.log(command.usage);
    return 0;
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: command.options,
      allowPositionals: command.allowPositionals ?? false,
      strict: true,
    });
  } catch (error) {
    console.error(`styles ${name}: ${error.message}\n\n${command.usage}`);
    return 2;
  }

  if (!existsSync(join(ROOT, "app/src"))) {
    console.error(`styles: could not find app/src in the repository at ${ROOT}`);
    return 2;
  }

  return (await command.run(parsed)) ?? 0;
}
