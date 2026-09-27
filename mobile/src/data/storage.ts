import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
const DATABASE_NAME = 'acdc';
const STORAGE_KEY = 'acdc.app-state.v1';

export type StorageMode = 'sqlite' | 'browser';

export class StateStorage {
  private sqlite?: SQLiteConnection;
  private database?: SQLiteDBConnection;
  mode: StorageMode = 'browser';

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
      const consistency = await this.sqlite.checkConnectionsConsistency();
      const existing = await this.sqlite.isConnection(DATABASE_NAME, false);

      if (consistency.result && existing.result) {
        this.database = await this.sqlite.retrieveConnection(DATABASE_NAME, false);
      } else {
        this.database = await this.sqlite.createConnection(
          DATABASE_NAME,
          false,
          'no-encryption',
          1,
          false,
        );
      }

      await this.database.open();
      await this.database.execute(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          schema_version INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      this.mode = 'sqlite';
    } catch (error) {
      console.error('SQLite initialization failed; using browser storage.', error);
      this.mode = 'browser';
    }
  }

  async load(): Promise<unknown> {
    if (this.mode === 'sqlite' && this.database) {
      const result = await this.database.query('SELECT state_json FROM app_state WHERE id = 1;');
      const stateJson = result.values?.[0]?.state_json;
      return stateJson ? JSON.parse(String(stateJson)) as unknown : null;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as unknown : null;
  }

  async save(state: import('../types/models').AppState): Promise<void> {
    const stateJson = JSON.stringify(state);

    if (this.mode === 'sqlite' && this.database) {
      await this.database.run(
        `INSERT INTO app_state (id, schema_version, state_json, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           schema_version = excluded.schema_version,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at;`,
        [state.schemaVersion, stateJson, new Date().toISOString()],
      );
      return;
    }

    localStorage.setItem(STORAGE_KEY, stateJson);
  }
}
