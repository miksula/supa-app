import { UpdateType } from "@powersync/web";
import type {
  CommonPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
} from "@powersync/web";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { AuthService } from "./AuthService.ts";

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [
  new RegExp("^22...$"),
  new RegExp("^23...$"),
  new RegExp("^42501$"),
];

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly authService: AuthService,
    private readonly powersyncUrl: string,
  ) {}

  async fetchCredentials() {
    const session = await this.authService.getSession();

    if (!session) {
      throw new Error(
        "Could not fetch Supabase credentials: no active session",
      );
    }

    return {
      endpoint: this.powersyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    let lastOp: CrudEntry | null = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = this.authService.client.from(op.table);
        let result: PostgrestSingleResponse<null>;
        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq("id", op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq("id", op.id);
            break;
        }

        if (result.error) {
          result.error.message =
            `Could not update Supabase. Received error: ${result.error.message}`;
          throw result.error;
        }
      }

      await transaction.complete();
    } catch (ex: unknown) {
      const error = ex as { code?: string };
      if (
        typeof error.code === "string" &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code))
      ) {
        console.error("Data upload error - discarding:", lastOp, ex);
        await transaction.complete();
      } else {
        throw ex;
      }
    }
  }
}
