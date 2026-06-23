import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { z } from "zod";

import { STATUS_VALUES, type ProjectStatus } from "@/lib/schema";
import { normalizeFrontmatter } from "@/lib/markdown";

/**
 * The state a project publishes to the dashboard via a root-level `glass.md`.
 * Mirrors the three volatile card fields plus the slug that ties it to a card.
 * This is a SEPARATE file format from the card frontmatter — it only reuses
 * the status enum and ISO-date rule. It is never the secret-bearing schema.
 */
export interface GlassState {
  slug: string;
  status: ProjectStatus;
  last_worked_on: string;
  next_action?: string;
}

export type GlassParseResult =
  | { ok: true; state: GlassState }
  | { ok: false; error: string };

const glassStateSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, hyphens)"),
    status: z.enum(STATUS_VALUES),
    last_worked_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "last_worked_on must be an ISO date (YYYY-MM-DD)"),
    next_action: z.string().min(1).optional(),
  })
  .superRefine((d, ctx) => {
    if ((d.status === "in-progress" || d.status === "planned") && !d.next_action) {
      ctx.addIssue({
        code: "custom",
        message: "next_action is required for in-progress and planned projects",
        path: ["next_action"],
      });
    }
  });

/** Parse a raw glass.md string into typed state, or a human-readable error. */
export function parseGlassState(raw: string): GlassParseResult {
  let data: Record<string, unknown>;
  try {
    data = matter(raw).data;
  } catch (err) {
    return {
      ok: false,
      error: `Could not parse glass.md frontmatter: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const parsed = glassStateSchema.safeParse(normalizeFrontmatter(data));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, state: parsed.data };
}

/** Read and parse `<projectDir>/glass.md`. Missing file → a clear, actionable error. */
export async function readGlassState(projectDir: string): Promise<GlassParseResult> {
  const filePath = path.join(projectDir, "glass.md");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        error: `No glass.md found at ${filePath}. Paste GLASS_PROMPT.md into Claude Code inside that project to create one.`,
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return parseGlassState(raw);
}
