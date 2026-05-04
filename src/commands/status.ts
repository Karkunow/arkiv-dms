import { publicClient } from "../lib/arkiv.js";
import { parseSwitch } from "../schemas.js";
import { formatTTL } from "../lib/ttl.js";

export async function status(entityKey: string): Promise<void> {
  const entity = await publicClient.getEntity(entityKey as `0x${string}`);
  const sw = parseSwitch(entity);

  const expiresAtAttr = entity.attributes?.find(
    (a: { key: string; value: unknown }) => a.key === "expiresAt"
  );
  const expiresAt: number =
    typeof expiresAtAttr?.value === "number"
      ? expiresAtAttr.value
      : sw.createdAt + sw.checkinIntervalSeconds * 1000;

  const secondsLeft = Math.floor((expiresAt - Date.now()) / 1000);

  const bar = "─".repeat(56);
  console.log(`\n${bar}`);
  console.log(`  Switch:   ${entityKey}`);
  console.log(`  Status:   ${secondsLeft > 0 ? "🟢 Armed" : "🔴 Triggered / expired"}`);
  console.log(`  Triggers: ${secondsLeft > 0 ? `in ${formatTTL(secondsLeft)}` : "now"}`);
  console.log(`  Interval: check in every ${formatTTL(sw.checkinIntervalSeconds)}`);
  console.log(`  Created:  ${new Date(sw.createdAt).toLocaleString()}`);
  console.log(`${bar}\n`);
}
