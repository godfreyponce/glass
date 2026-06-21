import matter from "gray-matter";

import type { ProjectFrontmatter } from "@/lib/schema";

/**
 * YAML parses an unquoted `2026-06-20` into a JS `Date`, which fails the
 * schema's string date fields (the hand-written seed files quote theirs, but
 * an agent-written file may not). Coerce any top-level `Date` back to a
 * `YYYY-MM-DD` string (UTC slice, so the calendar day never shifts) before
 * validation. No-op for already-correct string dates.
 */
export function normalizeFrontmatter(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return out;
}

/**
 * Serializes validated frontmatter into a `.md` file string: a YAML
 * frontmatter block followed by a starter markdown body. Used by the
 * API route before committing to GitHub.
 */
export function serializeProject(
  frontmatter: ProjectFrontmatter,
  body?: string,
): string {
  // Drop undefined optionals so they don't serialize as `null`.
  const data = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined),
  );

  const starterBody =
    body && body.trim().length > 0
      ? body.trim()
      : `# ${frontmatter.name}\n\n${
          frontmatter.recruiter_pitch ?? "Notes go here."
        }\n`;

  return matter.stringify(`\n${starterBody}\n`, data);
}
