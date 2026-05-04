import { walletClient, publicClient } from "../lib/arkiv.js";
import { formatTTL } from "../lib/ttl.js";

export async function checkin(entityKey: string): Promise<void> {
  // Fetch the entity to read the checkin interval from attributes
  const entity = await publicClient.getEntity(entityKey as `0x${string}`);

  // Pull checkinInterval from attributes
  const intervalAttr = entity.attributes?.find(
    (a: { key: string; value: unknown }) => a.key === "checkinInterval"
  );
  const ttlSeconds: number =
    typeof intervalAttr?.value === "number" ? intervalAttr.value : 60;

  await walletClient.extendEntity({
    entityKey: entityKey as `0x${string}`,
    expiresIn: ttlSeconds,
  });

  console.log(
    `\n✅  Checked in. Clock reset — triggers in ${formatTTL(ttlSeconds)} if you don't check in again.\n`
  );
}
