import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

import {
  projectFrontmatterSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";

const PROJECTS_DIR = path.join(process.cwd(), "content", "projects");

export interface ProjectDetail {
  frontmatter: ProjectFrontmatter;
  /** Raw markdown body (everything below the frontmatter), as it lives in the file. */
  body: string;
  /** Rendered HTML of the markdown body. */
  html: string;
}

async function readProjectFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR);
    return entries.filter((f) => f.endsWith(".md"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`content/projects/ not found at ${PROJECTS_DIR}`);
      return [];
    }
    throw err;
  }
}

/**
 * Reads every `.md` in content/projects/, validates frontmatter against the
 * locked schema, and returns a typed array. Invalid files are skipped with a
 * warning so one bad file never breaks the dashboard.
 * Sorted by last_worked_on (most recent first).
 */
export async function readAllProjects(): Promise<ProjectFrontmatter[]> {
  const files = await readProjectFiles();
  const projects: ProjectFrontmatter[] = [];

  for (const file of files) {
    const fullPath = path.join(PROJECTS_DIR, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const { data } = matter(raw);

    const parsed = projectFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      console.warn(
        `Skipping ${file}: frontmatter failed schema validation — ` +
          parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; "),
      );
      continue;
    }

    const expectedSlug = file.replace(/\.md$/, "");
    if (parsed.data.slug !== expectedSlug) {
      console.warn(
        `Slug mismatch in ${file}: frontmatter slug "${parsed.data.slug}" ` +
          `does not match filename "${expectedSlug}". Using frontmatter slug.`,
      );
    }

    projects.push(parsed.data);
  }

  return projects.sort((a, b) =>
    b.last_worked_on.localeCompare(a.last_worked_on),
  );
}

/**
 * Reads a single project by slug. Returns null if the file is missing or its
 * frontmatter fails validation.
 */
export async function readProject(
  slug: string,
): Promise<ProjectDetail | null> {
  // Guard against path traversal — slug must be a plain kebab token.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  const fullPath = path.join(PROJECTS_DIR, `${slug}.md`);

  let raw: string;
  try {
    raw = await fs.readFile(fullPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }

  const { data, content } = matter(raw);
  const parsed = projectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    console.warn(
      `Project ${slug}.md failed schema validation: ` +
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; "),
    );
    return null;
  }

  const processed = await remark().use(html).process(content);

  return {
    frontmatter: parsed.data,
    body: content,
    html: processed.toString(),
  };
}
