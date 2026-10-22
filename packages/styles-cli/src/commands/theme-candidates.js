import { analyzeThemeCandidates } from "../analyzers/findThemeCandidates.js";

export const name = "theme-candidates";
export const summary = "Find candidates for design system tokens";
export const usage = `USAGE
  styles theme-candidates [--json]

FLAGS
  --json   Print machine-readable output`;
export const options = {
  json: { type: "boolean" },
};

export async function run({ values }) {
  const result = await analyzeThemeCandidates();

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log("=== 1. Scale Bypasses (Existing Token Available) ===");
  if (result.scaleBypasses.length === 0) {
    console.log("  None found.");
  } else {
    for (const item of result.scaleBypasses) {
      console.log(
        `  ${item.file}:${item.line}  ${item.property}: ${item.value}  ->  ${item.suggestedToken}`,
      );
    }
  }

  console.log("\n=== 2. Theme Token Candidates (Ranked by Heuristic Score) ===");
  if (result.candidates.length === 0) {
    console.log("  None found.");
  } else {
    for (const c of result.candidates) {
      const files = [...new Set(c.locations.map((l) => `${l.file}:${l.line}`))].join(", ");
      const tag = c.derived ? " [derived]" : "";
      console.log(
        `  [score ${c.score}] (${c.category}${tag}) ${c.value} — ${c.totalOccurrences}x across ${c.distinctFiles} file(s)`,
      );
      console.log(`    at ${files}`);
    }
  }

  console.log("\n=== 3. Unused Project Tokens in app/src/css/vars.css ===");
  if (result.unusedTokens.length === 0) {
    console.log("  None — all semantic tokens in vars.css are referenced.");
  } else {
    for (const token of result.unusedTokens) {
      console.log(`  ${token}`);
    }
  }
  return 0;
}
