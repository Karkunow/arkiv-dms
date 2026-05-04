import { createWalletClient, createPublicClient, http } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { kaolin } from "@arkiv-network/sdk/chains";

export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: "arkiv-dms-v1",
} as const;

export const publicClient = createPublicClient({
  chain: kaolin,
  transport: http(),
});

function createWallet() {
  const raw = process.env.PRIVATE_KEY;
  if (!raw) {
    throw new Error("PRIVATE_KEY is not set. Copy .env.example → .env and add your key.");
  }
  return createWalletClient({
    chain: kaolin,
    transport: http(),
    account: privateKeyToAccount(raw as `0x${string}`),
  });
}

export const walletClient = createWallet();
