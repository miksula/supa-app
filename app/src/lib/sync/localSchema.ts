import { ResolvedTable, Schema } from "@powersync/web";
import { AppSchema } from "./schema.ts";

/**
 * The generated AppSchema with every table marked local-only: same tables and
 * columns, stored in `ps_data_local__*` and never written to the upload queue.
 */
export const LocalOnlySchema = new Schema(
  AppSchema.tables.map((table) => new ResolvedTable({ ...table.options, localOnly: true })),
);
