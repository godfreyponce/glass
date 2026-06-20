import { z } from "zod";

/**
 * Locked frontmatter schema — the spine of the app (see CLAUDE.md → "Schema is sacred").
 * The read layer, the API route, the form, and every `.md` file all
 * conform to this. Never loosen it without flagging a breaking change.
 */

export const STATUS_VALUES = [
  "planned",
  "in-progress",
  "completed",
  "archived",
] as const;

export const PRIORITY_VALUES = ["high", "medium", "low"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

const slugField = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case (a-z, 0-9, hyphens)");

/**
 * A pointer to an API key this project uses. Metadata only — never the secret.
 * `provider` is a lowercase id that maps to /logos/<provider>.png; `location`
 * is where YOU access the real key (1Password, an .env file, …).
 */
export const apiKeySchema = z.object({
  provider: z
    .string()
    .regex(/^[a-z0-9-]+$/, "provider must be a lowercase id (a-z, 0-9, hyphens)"),
  location: z.string().min(1, "location is required"),
  // Human name that distinguishes multiple keys from the same provider
  // (e.g. "personal" vs "client-acme"). Identity falls back to location.
  label: z.string().min(1).optional(),
  env_var: z.string().min(1).optional(),
});

const baseShape = {
  name: z.string().min(1, "name is required"),
  status: z.enum(STATUS_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  stack: z.array(z.string().min(1)).min(1, "stack needs at least one item"),
  started: isoDate,
  last_worked_on: isoDate,
  next_action: z.string().min(1).optional(),
  run_command: z.string().min(1).optional(),
  entry_point: z.string().min(1).optional(),
  // Private — never rendered on the public view (see detail page gate).
  local_path: z.string().min(1).optional(),
  repo_url: z.url().optional(),
  live_url: z.url().optional(),
  recruiter_pitch: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  // Pointers to the project's active API keys — metadata only, never secrets.
  api_keys: z.array(apiKeySchema).optional(),
};

type RefineInput = { status: (typeof STATUS_VALUES)[number]; next_action?: string };

function requireNextAction(
  data: RefineInput,
  ctx: z.RefinementCtx,
): void {
  if (
    (data.status === "in-progress" || data.status === "planned") &&
    !data.next_action
  ) {
    ctx.addIssue({
      code: "custom",
      message: "next_action is required for in-progress and planned projects",
      path: ["next_action"],
    });
  }
}

/** Full frontmatter as it lives in a `.md` file (slug required). */
export const projectFrontmatterSchema = z
  .object({ slug: slugField, ...baseShape })
  .superRefine(requireNextAction);

/** Form / API input — slug optional (derived from name when absent). */
export const projectInputSchema = z
  .object({ slug: slugField.optional(), ...baseShape })
  .superRefine(requireNextAction);

export type ApiKey = z.infer<typeof apiKeySchema>;
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectStatus = (typeof STATUS_VALUES)[number];
export type ProjectPriority = (typeof PRIORITY_VALUES)[number];

/**
 * Patch shape for `PATCH /api/projects/[slug]`. Every field is optional;
 * optional fields may be `null` to clear them; `slug` is explicitly not
 * patchable (renaming a file is delete+create, not a patch). `.strict()`
 * rejects unknown keys so the client can't sneak in extras.
 */
export const projectPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.enum(STATUS_VALUES).optional(),
    priority: z.enum(PRIORITY_VALUES).optional(),
    stack: z.array(z.string().min(1)).min(1).optional(),
    started: isoDate.optional(),
    last_worked_on: isoDate.optional(),
    next_action: z.string().min(1).nullable().optional(),
    run_command: z.string().min(1).nullable().optional(),
    entry_point: z.string().min(1).nullable().optional(),
    local_path: z.string().min(1).nullable().optional(),
    repo_url: z.url().nullable().optional(),
    live_url: z.url().nullable().optional(),
    recruiter_pitch: z.string().min(1).nullable().optional(),
    tags: z.array(z.string().min(1)).nullable().optional(),
    api_keys: z.array(apiKeySchema).nullable().optional(),
    /** Raw markdown body (everything below the frontmatter). Not a
     *  frontmatter field — kept here for transport convenience. */
    body: z.string().optional(),
  })
  .strict();

export type ProjectPatch = z.infer<typeof projectPatchSchema>;
