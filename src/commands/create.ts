import { jsonToPayload } from "@arkiv-network/sdk/utils";
import { getWalletClient, PROJECT_ATTRIBUTE } from "../lib/arkiv.js";
import { parseTTL, formatTTL } from "../lib/ttl.js";

export interface CreateOptions {
  message: string;
  ttl: string;
}

export async function createSwitch(opts: CreateOptions): Promise<void> {
  const message = opts.message.trim();
  if (!message) throw new Error("Message cannot be empty.");
  if (message.length > 10_000) throw new Error("Message too long (max 10 000 chars).");

  const ttlSeconds = parseTTL(opts.ttl);
  if (ttlSeconds < 10) throw new Error("TTL must be at least 10s.");

  const switchId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  const walletClient = getWalletClient();

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: jsonToPayload({
      message,
      switchId,
      checkinIntervalSeconds: ttlSeconds,
      createdAt: now,
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: "switch" },
      { key: "switchId", value: switchId },
      { key: "createdAt", value: now },
      // expiresAt stored so status command can show remaining time
      { key: "expiresAt", value: expiresAt },
      // checkinInterval stored so checkin command can re-extend by the same duration
      { key: "checkinInterval", value: ttlSeconds },
    ],
    expiresIn: ttlSeconds,
  });

  const bar = "─".repeat(56);
  console.log(`\n${bar}`);
  console.log(`  💀  Dead Man's Switch armed`);
  console.log(`${bar}`);
  console.log(`  Key:      ${entityKey}`);
  console.log(`  TTL:      ${formatTTL(ttlSeconds)} — triggers if you don't check in`);
  console.log(`  Tx:       ${txHash}`);
  console.log(`${bar}`);
  console.log(`\nCheck in to reset the clock:`);
  console.log(`  npm run dev -- checkin ${entityKey}`);
  console.log(`\nCancel at any time:`);
  console.log(`  npm run dev -- cancel ${entityKey}\n`);
}
