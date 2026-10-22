import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  BASELINE_FILE,
  buildBaseline,
  checkProject,
  splitByBaseline,
} from "../analyzers/checkStyles.js";

export const name = "report";
export const summary = "Report violations (not in the baseline)";
export const usage = `USAGE
  styles report [--update-baseline] [--all]

FLAGS
  --update-baseline   Accept the current violations as the baseline
  --all               Also list baselined violations`;
export const options = {
  "update-baseline": { type: "boolean" },
  all: { type: "boolean" },
};

export async function run({ values }) {
  const violations = await checkProject();

  if (values["update-baseline"]) {
    writeFileSync(BASELINE_FILE, JSON.stringify(buildBaseline(violations), null, 2) + "\n");
    console.log(`Baseline updated: ${violations.length} violations recorded.`);
    return 0;
  }

  const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};
  const { fresh, known } = splitByBaseline(violations, baseline);
  const print = (list, prefix = "") => {
    for (const v of list)
      console.error(`${prefix}${v.file}:${v.line}:${v.column} ${v.rule} ${v.message}`);
  };

  if (values.all) print(known, "(baseline) ");
  print(fresh);
  console.log(`${fresh.length} new violation(s), ${known.length} in baseline.`);
  return fresh.length > 0 ? 1 : 0;
}
