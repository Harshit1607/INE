import dotenv from 'dotenv';
dotenv.config();

import { SupabaseAttemptStore } from '../service/supabase-attempt-store.js';
import { CatalogSnapshotService } from '../catalog/catalog-snapshot.js';
import { CatalogClient } from '../catalog/catalog-client.js';

async function main() {
  console.log('[SyncCatalog] Starting catalog sync CLI...');
  let supabaseClient = null;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const store = new SupabaseAttemptStore();
    supabaseClient = store.getClient();
  } else {
    console.warn('[SyncCatalog] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Running in dry mode.');
  }

  const catalogClient = new CatalogClient();
  const service = new CatalogSnapshotService(supabaseClient, catalogClient);

  const result = await service.syncSnapshot((msg) => console.log(msg));
  console.log(`[SyncCatalog] Finished! Synced ${result.totalSynced} products in ${result.durationMs}ms.`);
}

main().catch(console.error);
