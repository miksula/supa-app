#!/usr/bin/env node
import { toCSS } from "../../../../scripts/toCSS.js";

const [, , className, utilities] = process.argv;
if (!className || !utilities) {
  console.error('Usage: node toCSS.js <className> "<utilities>"');
  process.exit(1);
}

const css = await toCSS(className, utilities);
console.log(css);
