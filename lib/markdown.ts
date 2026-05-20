import matter from "gray-matter";

import type { ProjectFrontmatter } from "@/lib/schema";

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
