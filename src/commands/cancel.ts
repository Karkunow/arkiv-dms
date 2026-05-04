import { walletClient } from "../lib/arkiv.js";

export async function cancelSwitch(entityKey: string): Promise<void> {
  const { txHash } = await walletClient.deleteEntity({
    entityKey: entityKey as `0x${string}`,
  });
  console.log(`\n🗑️  Switch ${entityKey} cancelled.\n   Tx: ${txHash}\n`);
}
