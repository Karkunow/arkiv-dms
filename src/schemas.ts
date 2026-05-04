import { z } from "zod";

export const SwitchSchema = z.object({
  message: z.string(),
  switchId: z.string(),
  checkinIntervalSeconds: z.number(),
  createdAt: z.number(),
});

export type Switch = z.infer<typeof SwitchSchema>;

export function parseSwitch(entity: { toJson: () => unknown }): Switch {
  const result = SwitchSchema.safeParse(entity.toJson());
  if (!result.success) {
    throw new Error(`Not a DMS switch entity: ${result.error.message}`);
  }
  return result.data;
}
