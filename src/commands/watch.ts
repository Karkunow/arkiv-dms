import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, PROJECT_ATTRIBUTE } from "../lib/arkiv.js";
import { parseSwitch } from "../schemas.js";
import { formatTTL } from "../lib/ttl.js";

interface CachedSwitch {
  message: string;
  switchId: string;
  checkinIntervalSeconds: number;
  expiresAt: number; // ms timestamp
}

export async function watch(): Promise<void> {
  const publicClient = getPublicClient();

  // Local cache: entityKey → switch data
  // Populated on startup from active switches + from onEntityCreated events.
  // We need this because onEntityExpired only gives us entityKey — the entity
  // is already gone and can't be fetched.
  const cache = new Map<string, CachedSwitch>();

  // ── Pre-populate cache from active switches ──────────────────────────────
  console.log("\n🔍  Scanning for active switches...");
  try {
    const existing = await publicClient
      .buildQuery()
      .where([
        eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
        eq("entityType", "switch"),
      ])
      .withPayload(true)
      .withAttributes(true)
      .limit(200)
      .fetch();

    for (const entity of existing.entities) {
      try {
        const sw = parseSwitch(entity);
        // Pull expiresAt from attribute if present, otherwise estimate
        const expiresAtAttr = entity.attributes?.find(
          (a: { key: string; value: unknown }) => a.key === "expiresAt"
        );
        const expiresAt =
          typeof expiresAtAttr?.value === "number"
            ? expiresAtAttr.value
            : Date.now() + sw.checkinIntervalSeconds * 1000;
        cache.set(entity.key, {
          message: sw.message,
          switchId: sw.switchId,
          checkinIntervalSeconds: sw.checkinIntervalSeconds,
          expiresAt,
        });
      } catch {
        // Not a valid switch — skip
      }
    }
  } catch (err) {
    console.error("  Warning: could not pre-load active switches:", err);
  }

  if (cache.size > 0) {
    console.log(`  Found ${cache.size} active switch(es) — watching them.\n`);
  } else {
    console.log("  No active switches yet.\n");
  }

  const bar = "─".repeat(56);
  console.log(`${bar}`);
  console.log(`  💀  Dead Man's Switch — Watcher running`);
  console.log(`  Ctrl-C to stop`);
  console.log(`${bar}\n`);

  // ── Subscribe to live events ─────────────────────────────────────────────
  const unsubscribe = await publicClient.subscribeEntityEvents(
    {
      // New switch created — fetch its payload and cache it
      onEntityCreated: async (event) => {
        try {
          const entity = await publicClient.getEntity(event.entityKey);
          const sw = parseSwitch(entity);

          const expiresAt = Date.now() + sw.checkinIntervalSeconds * 1000;
          cache.set(event.entityKey, {
            message: sw.message,
            switchId: sw.switchId,
            checkinIntervalSeconds: sw.checkinIntervalSeconds,
            expiresAt,
          });

          console.log(`[${ts()}] 🟢  ARMED    ${event.entityKey}`);
          console.log(
            `           Triggers in ${formatTTL(sw.checkinIntervalSeconds)} unless checked in\n`
          );
        } catch {
          // Not one of our switches — ignore
        }
      },

      // Owner checked in — clock was reset
      onEntityExpiresInExtended: (event) => {
        const cached = cache.get(event.entityKey);
        if (!cached) return;

        // Reset the countdown
        cached.expiresAt = Date.now() + cached.checkinIntervalSeconds * 1000;

        console.log(`[${ts()}] ✅  CHECKIN  ${event.entityKey}`);
        console.log(
          `           Clock reset — ${formatTTL(cached.checkinIntervalSeconds)} until next trigger\n`
        );
      },

      // Switch expired — owner didn't check in → REVEAL
      onEntityExpired: (event) => {
        const cached = cache.get(event.entityKey);
        if (!cached) return;

        cache.delete(event.entityKey);

        console.log(`\n${"═".repeat(56)}`);
        console.log(`  💀  TRIGGERED  ${event.entityKey}`);
        console.log(`${"═".repeat(56)}`);
        console.log(`\n  "${cached.message}"\n`);
        console.log(`${"═".repeat(56)}\n`);
      },

      // Switch manually cancelled by owner
      onEntityDeleted: (event) => {
        const cached = cache.get(event.entityKey);
        if (!cached) return;

        cache.delete(event.entityKey);
        console.log(`[${ts()}] 🗑️   CANCELLED ${event.entityKey}\n`);
      },

      onError: (error) => {
        console.error(`[${ts()}] ⚠️  ERROR`, error);
      },
    },
    3_000 // poll every 3s — Kaolin block time is 2s
  );

  // ── Live countdown ticker ────────────────────────────────────────────────
  // Every second, overwrite a single status line showing all armed switches
  // and their remaining time. Uses \r to redraw in place without scrolling.
  const ticker = setInterval(() => {
    if (cache.size === 0) return;

    const parts: string[] = [];
    for (const [key, sw] of cache.entries()) {
      const secondsLeft = Math.max(
        0,
        Math.floor((sw.expiresAt - Date.now()) / 1000)
      );
      const short = key.slice(0, 10) + "…";
      parts.push(`${short} ⏱ ${formatTTL(secondsLeft)}`);
    }

    // \r returns to start of line; padding clears leftover chars
    process.stdout.write(`\r  ⏳  ${parts.join("   ")}`.padEnd(72));
  }, 1_000);

  // Keep the process alive and clean up on Ctrl-C
  process.on("SIGINT", () => {
    clearInterval(ticker);
    unsubscribe();
    process.stdout.write("\r" + " ".repeat(72) + "\r"); // clear ticker line
    console.log("\nWatcher stopped.\n");
    process.exit(0);
  });

  await new Promise<never>(() => {});
}

/** Compact timestamp for log lines */
function ts(): string {
  return new Date().toLocaleTimeString();
}
