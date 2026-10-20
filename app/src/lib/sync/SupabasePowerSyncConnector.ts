import type { CommonPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";
import type { SupabaseClient } from "@supabase/supabase-js";

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [new RegExp("^22...$"), new RegExp("^23...$"), new RegExp("^42501$")];

function isFatalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = error.code;
  return typeof code === "string" && FATAL_RESPONSE_CODES.some((pattern) => pattern.test(code));
}

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly client: SupabaseClient,
    private readonly powersyncUrl: string,
  ) {}

  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }

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

    try {
      const { error } = await this.client.rpc("process_powersync_crud", {
        ops: transaction.crud.map((entry) => ({
          op: entry.op,
          table: entry.table,
          id: entry.id,
          opData: entry.opData,
        })),
      });
      if (error) {
        error.message = `Could not update Supabase. Received error: ${error.message}`;
        throw error;
      }
    } catch (error: unknown) {
      if (!isFatalError(error)) throw error;
      console.error("Data upload error - discarding:", transaction.crud, error);
    }
    await transaction.complete();
  }
}
