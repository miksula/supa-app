import { describe, expect, it } from "vitest";
import { LocalOnlySchema } from "./localSchema.ts";
import { AppSchema } from "./schema.ts";

describe("LocalOnlySchema", () => {
  it("marks every table as local-only while preserving table, column, and index definitions", () => {
    expect(LocalOnlySchema.tables.length).toBe(AppSchema.tables.length);

    for (const [index, localTable] of LocalOnlySchema.tables.entries()) {
      const syncedTable = AppSchema.tables[index];
      expect(localTable.name).toBe(syncedTable.name);
      expect(localTable.localOnly).toBe(true);
      expect(syncedTable.localOnly).toBe(false);
      expect(localTable.columns.map((c) => ({ name: c.name, type: c.type }))).toEqual(
        syncedTable.columns.map((c) => ({ name: c.name, type: c.type })),
      );
      expect(localTable.indexes.map((i) => i.name)).toEqual(syncedTable.indexes.map((i) => i.name));
    }
  });
});
