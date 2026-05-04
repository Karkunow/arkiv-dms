# arkiv-dms

A Dead Man's Switch CLI built on [Arkiv](https://arkiv.network) — a decentralized ephemeral database on Ethereum.

Arm a switch with a secret message and a TTL. If you keep checking in, the message stays hidden. If you stop — it triggers and the watcher reveals it.

---

## Setup

### Prerequisites

- Node.js 20+
- An Ethereum private key with testnet ETH on [Kaolin](https://kaolin.hoodi.arkiv.network)

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env
# edit .env and set PRIVATE_KEY=0x...
```

### Run

```bash
# Terminal 1 — start the watcher
npm run dev -- watch

# Terminal 2 — arm a switch
npm run dev -- create --message "my secret" --ttl 1m

# Check in to reset the clock
npm run dev -- checkin <key>

# Check status
npm run dev -- status <key>

# Cancel
npm run dev -- cancel <key>
```

---

## Network

Runs on the **Kaolin testnet** — Arkiv's Hoodi-based test chain.

- Chain ID: `60138453025`
- RPC: `https://kaolin.hoodi.arkiv.network/rpc`
- Block time: ~2 seconds

---

## How it works

### The core primitive

Arkiv stores **entities** — arbitrary JSON blobs — on-chain with a mandatory expiry (`expiresIn`). When the TTL runs out, the entity is automatically deleted by the network. This makes it a natural fit for a Dead Man's Switch: the trigger *is* the expiry.

### Data model

Each switch is a single Arkiv entity with:

| Field | Storage | Purpose |
|---|---|---|
| `message` | JSON payload | The secret to reveal |
| `switchId` | payload + attribute | Unique identifier (UUID) |
| `checkinIntervalSeconds` | payload + attribute | How long to extend on each check-in |
| `createdAt` | payload + attribute | Creation timestamp (ms) |
| `expiresAt` | attribute | Absolute expiry timestamp (ms), kept in sync for the status command |
| `entityType: "switch"` | attribute | Allows the watcher to filter by type |
| `project: "arkiv-dms-v1"` | attribute | Namespaces all app data in the shared Arkiv DB |

All attributes are indexed and queryable. The payload is content-addressed and stored alongside the entity.

### Commands

#### `create`

```
npm run dev -- create --message "If you're reading this, I didn't make it." --ttl 5m
```

1. Parses the TTL string (`5m` → 300 seconds) via `src/lib/ttl.ts`
2. Calls `walletClient.createEntity()` with the message in the JSON payload and metadata in attributes
3. Sets `expiresIn: ttlSeconds` — Arkiv enforces this at the network level
4. Prints the entity key (a `0x…` hex address) — this is how you reference the switch later

TTL formats: `20s`, `5m`, `1h`, `7d`, `2w`

#### `checkin`

```
npm run dev -- checkin <key>
```

1. Fetches the entity to read the `checkinInterval` attribute
2. Calls `walletClient.extendEntity({ entityKey, expiresIn })` — this resets the TTL from now
3. The switch stays armed; the clock resets

Each check-in extends by the original TTL. Miss the window and the entity expires on its own.

#### `status`

```
npm run dev -- status <key>
```

Reads the `expiresAt` attribute and prints how much time remains before the switch triggers.

#### `cancel`

```
npm run dev -- cancel <key>
```

Calls `walletClient.deleteEntity({ entityKey })` — immediately removes the entity. Only the address that created it (the `$owner`) can do this.

#### `watch`

```
npm run dev -- watch
```

The watcher is the most interesting part:

1. **Pre-populates a local cache** — queries all active switches (`project = "arkiv-dms-v1"` AND `entityType = "switch"`) using Arkiv's attribute query system, fetches their payloads, and stores `{ message, switchId, checkinIntervalSeconds, expiresAt }` in a `Map<entityKey, CachedSwitch>`

2. **Subscribes to live entity events** via `publicClient.subscribeEntityEvents()` (polling every ~3 seconds against the Arkiv node):
   - `onEntityCreated` → fetch the new entity, parse it, add to cache, log `🟢 ARMED`
   - `onEntityExpiresInExtended` → reset `cached.expiresAt`, log `✅ CHECKIN`
   - `onEntityExpired` → **read message from cache**, print it in a bordered reveal box, delete from cache
   - `onEntityDeleted` → log `🗑️ CANCELLED`, delete from cache

3. **Countdown ticker** — a `setInterval` running every second writes a single line to stdout using `\r` (carriage return without newline) showing time remaining for each active switch, overwriting itself in-place

> **Why a local cache?** When `onEntityExpired` fires, the entity is already gone from the chain — `getEntity()` would return nothing. The message must be held in memory from when the entity was first seen. The watcher must be running when the switch is created (or already running when it starts) to catch the `onEntityCreated` event and cache the payload.

### Architecture

```
src/
├── cli.ts                  # Commander entry point, wires all commands
├── schemas.ts              # Zod schema for the switch payload, parseSwitch()
├── lib/
│   ├── arkiv.ts            # Client factories (WalletClient / PublicClient), PROJECT_ATTRIBUTE
│   └── ttl.ts              # parseTTL() / formatTTL() helpers
└── commands/
    ├── create.ts           # createSwitch()
    ├── checkin.ts          # checkin()
    ├── status.ts           # status()
    ├── cancel.ts           # cancelSwitch()
    └── watch.ts            # watch() — pre-load cache + subscribe to events + countdown
```

### Arkiv concepts used

| Concept | Where |
|---|---|
| `createEntity` with `expiresIn` | `create.ts` — the TTL is the trigger |
| `extendEntity` | `checkin.ts` — resets the clock |
| `deleteEntity` | `cancel.ts` — manual disarm |
| `getEntity` | `checkin.ts`, `status.ts`, `watch.ts` (on `onEntityCreated`) |
| Attribute queries (`eq`) | `watch.ts` — pre-load scan |
| `subscribeEntityEvents` | `watch.ts` — live event stream |
| `jsonToPayload` / `toJson()` | `create.ts` / `schemas.ts` — payload serialization |
| `WalletClient` vs `PublicClient` | write ops need a key; watch only needs `PublicClient` |
