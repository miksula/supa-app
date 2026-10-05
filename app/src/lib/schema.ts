import { column, Schema, Table } from "@powersync/web";

const lists = new Table(
  {
    // id column (text) is automatically included
    created_at: column.text,
    name: column.text,
    owner_id: column.text,
  },
  { indexes: {} },
);

const todos = new Table(
  {
    // id column (text) is automatically included
    created_at: column.text,
    completed_at: column.text,
    description: column.text,
    completed: column.integer,
    created_by: column.text,
    completed_by: column.text,
    list_id: column.text,
  },
  { indexes: {} },
);

export const AppSchema = new Schema({
  lists,
  todos,
});

export type Database = (typeof AppSchema)["types"];
