import { UpdateType } from "@powersync/web";
import type { CommonPowerSyncDatabase, CrudEntry, PowerSyncBackendConnector } from "@powersync/web";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { AuthService } from "../auth/AuthService.ts";

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [new RegExp("^22...$"), new RegExp("^23...$"), new RegExp("^42501$")];

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly authService: AuthService,
    private readonly powersyncUrl: string,
  ) {}

  async fetchCredentials() {
    const session = await this.authService.getSession();

    if (!session) {
      throw new Error("Could not fetch Supabase credentials: no active session");
    }

    return {
      endpoint: this.powersyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    let lastOp: CrudEntry | null = null;
    try {
      if (transaction.crud.length > 1) {
        /*
         * PowerSync can return several related local writes in one transaction,
         * such as deleting a list and its todos. Send those operations through
         * the PostgreSQL RPC so they are processed as one server-side batch.
         * Single operations use PostgREST below because no batch RPC is needed.
         *
         * The SDK serializes the table name as `type`, while the RPC expects
         * `table`, so add the field explicitly before sending the payload.
         *
         * The `process_powersync_crud` RPC is created separately by the
         * `*_process_powersync_crud.sql` migration in the infra `stack/`.
         */
        lastOp = transaction.crud.at(-1) ?? null;
        const { error } = await this.authService.client.rpc("process_powersync_crud", {
          ops: transaction.crud.map((op) => ({
            ...op,
            table: op.table,
          })),
        });

        if (error) {
          error.message = `Could not update Supabase. Received error: ${error.message}`;
          throw error;
        }
      } else {
        for (const op of transaction.crud) {
          lastOp = op;
          const table = this.authService.client.from(op.table);
          let result: PostgrestSingleResponse<null>;
          const opData = op.opData;
          switch (op.op) {
            case UpdateType.PUT:
              if (!opData) {
                throw new Error(`PUT operation for ${op.table} is missing operation data`);
              }
              result = await table.upsert({ ...opData, id: op.id });
              break;
            case UpdateType.PATCH:
              if (!opData) {
                throw new Error(`PATCH operation for ${op.table} is missing operation data`);
              }
              result = await table.update(opData).eq("id", op.id);
              break;
            case UpdateType.DELETE:
              result = await table.delete().eq("id", op.id);
              break;
            default:
              throw new Error(`Unsupported PowerSync operation: ${op.op}`);
          }

          if (result.error) {
            result.error.message = `Could not update Supabase. Received error: ${result.error.message}`;
            throw result.error;
          }
        }
      }

      await transaction.complete();
    } catch (ex: unknown) {
      const error = ex as { code?: string };
      const errorCode = error.code;
      if (
        typeof errorCode === "string" &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(errorCode))
      ) {
        console.error("Data upload error - discarding:", lastOp, ex);
        await transaction.complete();
      } else {
        throw ex;
      }
    }
  }
}
