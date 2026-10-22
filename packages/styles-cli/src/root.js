import { fileURLToPath } from "node:url";

/** Repository root, resolved relative to this package (packages/styles-cli/src). */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
