import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { ROOT } from "../root.js";

export const name = "to-css";
export const summary = "Compile Tailwind utilities into CSS for a custom class";
export const usage = `USAGE
  styles to-css <class-name> "<utilities>"

EXAMPLES
  $ styles to-css my-card "p-2 text-sm"`;
export const options = {};
export const allowPositionals = true;

/**
 * Compiles Tailwind utilities into CSS for a custom class.
 *
 * @param {string} className The class name to generate.
 * @param {string} utilities The Tailwind utility classes to apply.
 * @returns {Promise<string>} The generated CSS without the leading license comment.
 */
export async function toCSS(className, utilities) {
  const input = `
    @reference "tailwindcss";
    .${className} { @apply ${utilities}; }
  `;
  const compiler = await compile(input, {
    base: `${join(ROOT, "app")}/`,
    onDependency() {},
  });
  return compiler.build([className]).replace(/^\/\*![\s\S]*?\*\/\s*/, "");
}

export async function run({ positionals }) {
  if (positionals.length !== 2) {
    console.error(`styles to-css: expected 2 arguments, got ${positionals.length}\n\n${usage}`);
    return 2;
  }
  const [className, utilities] = positionals;
  console.log(await toCSS(className, utilities));
  return 0;
}
