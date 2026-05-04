#!/usr/bin/env node
import { config } from "dotenv";
config();

import { Command } from "commander";
import { createSwitch } from "./commands/create.js";
import { checkin } from "./commands/checkin.js";
import { status } from "./commands/status.js";
import { cancelSwitch } from "./commands/cancel.js";
import { watch } from "./commands/watch.js";

const program = new Command();

program
  .name("dms")
  .description("Dead Man's Switch — your message reveals itself if you disappear")
  .version("0.1.0");

// ── create ────────────────────────────────────────────────────────────────────
program
  .command("create")
  .description("Arm a new Dead Man's Switch with a secret message")
  .requiredOption("-m, --message <text>", "Secret message to reveal on trigger")
  .option("-t, --ttl <duration>", "How long before it triggers (e.g. 20s, 5m, 1h, 7d)", "24h")
  .action(async (opts) => {
    try {
      await createSwitch(opts);
    } catch (err: unknown) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── checkin ───────────────────────────────────────────────────────────────────
program
  .command("checkin <key>")
  .description("Check in to reset the clock — proves you are still alive")
  .action(async (key: string) => {
    try {
      await checkin(key);
    } catch (err: unknown) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── status ────────────────────────────────────────────────────────────────────
program
  .command("status <key>")
  .description("Show how much time remains before the switch triggers")
  .action(async (key: string) => {
    try {
      await status(key);
    } catch (err: unknown) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── cancel ────────────────────────────────────────────────────────────────────
program
  .command("cancel <key>")
  .description("Disarm and delete the switch (only you can do this)")
  .action(async (key: string) => {
    try {
      await cancelSwitch(key);
    } catch (err: unknown) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── watch ─────────────────────────────────────────────────────────────────────
program
  .command("watch")
  .description("Start the watcher — reveals messages when switches trigger")
  .action(async () => {
    try {
      await watch();
    } catch (err: unknown) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

await program.parseAsync(process.argv);
