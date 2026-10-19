import { compile } from "@tailwindcss/node";
import { fileURLToPath } from "node:url";

/**
 * Compiles Tailwind utilities into CSS for a custom class.
 *
 * @param {string} className The class name to generate.
 * @param {string} utilities The Tailwind utility classes to apply.
 * @returns {Promise<string>} The generated CSS without the leading license comment.
 *
 * @example
 * const css = await toCSS("btn", "bg-blue-500 text-white p-2");
 * console.log(css);
 *
 * // output
 * .btn {
 *   background-color: var(--color-blue-500, oklch(62.3% 0.214 259.815));
 *   padding: calc(var(--spacing, 0.25rem) * 2);
 *   color: var(--color-white, #fff);
 * }
 */
export async function toCSS(className, utilities) {
  const input = `
    @reference "tailwindcss";
    .${className} { @apply ${utilities}; }
  `;
  const compiler = await compile(input, {
    base: fileURLToPath(new URL("../app/", import.meta.url)),
    onDependency() {},
  });
  return compiler.build([className]).replace(/^\/\*![\s\S]*?\*\/\s*/, "");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , className, utilities] = process.argv;
  if (!className || !utilities) {
    console.error('Usage: node scripts/toCSS.js <className> "<utilities>"');
    process.exit(1);
  }
  const css = await toCSS(className, utilities);
  console.log(css);
}
