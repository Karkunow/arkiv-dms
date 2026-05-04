# Arkiv Developer Experience Review

## What Worked Well

1. **Documentation**
The docs are clean and easy to navigate.

2. **Agent skill**
The Copilot agent skill was provided upfront.

3. **Data model**
The data model is simple and deliberately limited. It positions Arkiv clearly as a purpose-built ephemeral web3 database.

4. **SDK ergonomics**
The API surface feels REST-like: `createEntity`, `getEntity`, `extendEntity`, `deleteEntity`. The `WalletClient` / `PublicClient` split is immediately familiar to anyone coming from viem or wagmi.

5. **`expiresIn` as a first-class primitive**
TTL is the in-build feature. The fact that expiry is enforced at the network level (not by application code) is very unique.
 

---

## What Didn't Work / Friction Points

1. **Kaolin explorer was down**
I wasn't able to see my transactions and their inner structure.

2. **"Why Arkiv?" section doesn't fit on screen**
The four value propositions can't all be seen at once without scrolling. This is the highest-signal section of the landing page — it should land as a single visual unit.

3. **Installation page structure**
SDK installation steps are mixed in with general setup. A better split:
    - Move SDK installation into the TypeScript SDK section
    - Add a "Try it out" or "Hello World" page as the primary entry point — one runnable example.

4. **`entity.toJson()` returns `any`**
The payload comes back untyped. There is no way to get type inference from the payload schema. Every project that stores structured data will need to add runtime validation (Zod, etc.) on top.

5. **`Hex` brand type on entity keys**
Entity keys look like plain strings (`0x...`) but the SDK requires the branded `0x${string}` type. This causes a type error that is not obvious from the docs and requires an explicit `as \`0x${string}\`` cast at every call site.

6. **`subscribeEntityEvents` has no server-side filter**
The subscription receives every entity event on the whole network. Filtering to your own project's entities must be done client-side.

7. **`onEntityExpired` delivers no payload**
When a switch expires, the entity is already deleted — `getEntity()` would return nothing. The payload must be cached locally before expiry, or it is lost. This is a sharp edge that will surprise every new developer building event-driven logic. It deserves a prominent warning in the `subscribeEntityEvents` docs.

8. **In-depth architectural questions are unanswered**
After the initial getting-started experience, these questions come up and have no clear answers in the docs:

    - How does the L2 network coordinate entity expiry? Is it enforced by the sequencer only, or proven on Ethereum?
    - What happens during settlement on Ethereum? Optimistic or ZK?
    - When should a developer use Arkiv vs a web2 database? 
    - How do you handle private data? There is no encryption layer. Combining Arkiv with something like Secret Network's encryption or client-side encryption before storing would be a useful guide.

---

## Ideas for Tooling, Docs, and Resources

- **Interactive API explorer in the docs**
An inline playground (like The Graph's GraphQL explorer or Stripe's API reference) would let developers test endpoints without leaving the page, without installing anything, and without writing code first. A Postman collection is a lower-friction starting point but still requires account creation and import. The goal is: see the response before you write your first line of code.

- **Refactor the Installation page**
    - SDK installation → move into the TypeScript SDK section
    - Installation page → becomes a quick-start "try it now" with a Hello World

- **"When to use Arkiv" decision guide**
A short section comparing Arkiv to web2 databases and other decentralized storage options with a simple decision tree: when the mandatory expiry, on-chain provenance, or decentralization matters — and when it doesn't.

- **Encryption integration guide**
A guide showing how to combine Arkiv with client-side encryption or a dedicated encryption network (e.g. Secret Network, Lit Protocol) for use cases where data privacy matters. Since Arkiv stores data in plain text, this is a natural follow-on question for any serious production use case.


- **Document edge cases explicitly**
For example, these should have clear answers in the SDK reference:

| Edge case | Question |
|---|---|
| Lost connection during `subscribeEntityEvents` | Does it reconnect? Are missed events replayed? |
| Max payload size | What is the limit? What error is thrown if exceeded? |
| Max attributes per entity | Is there a cap? |
| `onEntityExpired` vs `onEntityDeleted` | Are they mutually exclusive? What fires if you delete an already-expired entity? |
| Expiry race | If `extendEntity` and natural expiry happen in the same block, which wins? |
| Entity key derivation | How are entity keys generated? Are they deterministic? |
