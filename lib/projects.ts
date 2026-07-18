import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

import {
  projectFrontmatterSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";
import { normalizeFrontmatter } from "@/lib/markdown";
import { fetchPrivateCardRaw, fetchPrivateRaws } from "@/lib/private-store";

const PROJECTS_DIR = path.join(process.cwd(), "content", "projects");
const PRIVATE_PROJECTS_DIR = path.join(
  process.cwd(),
  "content",
  "private",
  "projects",
);

/** Which store a card came from. Derived from file location — never frontmatter. */
export type CardStore = "public" | "private";

export type ProjectWithSource = ProjectFrontmatter & { store: CardStore };

export interface AllProjectsResult {
  projects: ProjectWithSource[];
  /** Set when the private store could not be read (prod fetch failure).
   *  Public cards are unaffected — the UI shows this instead of silently
   *  dropping private cards. */
  privateStoreError: string | null;
}

export interface ProjectDetail {
  frontmatter: ProjectFrontmatter;
  store: CardStore;
  /** Raw markdown body (everything below the frontmatter), as it lives in the file. */
  body: string;
  /** Rendered HTML of the markdown body. */
  html: string;
}

interface RawCard {
  file: string;
  raw: string;
}

async function readDirRaws(dir: string): Promise<RawCard[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  return Promise.all(
    entries
      .filter((f) => f.endsWith(".md"))
      .map(async (file) => ({
        file,
        raw: await fs.readFile(path.join(dir, file), "utf8"),
      })),
  );
}

function parseCards(raws: RawCard[], store: CardStore): ProjectWithSource[] {
  const projects: ProjectWithSource[] = [];
  for (const { file, raw } of raws) {
    const { data } = matter(raw);
    const parsed = projectFrontmatterSchema.safeParse(normalizeFrontmatter(data));
    if (!parsed.success) {
      console.warn(
        `Skipping ${store} card ${file}: frontmatter failed schema validation — ` +
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
    projects.push({ ...parsed.data, store });
  }
  return projects;
}

/**
 * Pure merge of the two stores. Public wins slug collisions (with a warning)
 * so a private file can never shadow a public card. Sorted by last_worked_on
 * (most recent first).
 */
export function mergeProjects(
  publicCards: ProjectWithSource[],
  privateCards: ProjectWithSource[],
): ProjectWithSource[] {
  const publicSlugs = new Set(publicCards.map((p) => p.slug));
  const merged = [...publicCards];
  for (const cardEntry of privateCards) {
    if (publicSlugs.has(cardEntry.slug)) {
      console.warn(
        `Slug collision on "${cardEntry.slug}": exists in both stores; using the public card.`,
      );
      continue;
    }
    merged.push(cardEntry);
  }
  return merged.sort((a, b) => b.last_worked_on.localeCompare(a.last_worked_on));
}

/**
 * Loads raw private cards. Dev: the local clone at content/private/projects/.
 * Prod: fetched from the private GitHub repo.
 */
async function loadPrivateRaws(): Promise<{
  raws: RawCard[];
  error: string | null;
}> {
  if (process.env.NODE_ENV === "development") {
    return { raws: await readDirRaws(PRIVATE_PROJECTS_DIR), error: null };
  }
  try {
    return { raws: await fetchPrivateRaws(), error: null };
  } catch (err) {
    console.warn(
      `Private store fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      raws: [],
      error: "Couldn't load private cards right now — public cards are unaffected.",
    };
  }
}

/**
 * Reads every card from both stores, validates frontmatter against the locked
 * schema, and returns a typed, merged, sorted array. Invalid files are skipped
 * with a warning so one bad file never breaks the dashboard.
 */
export async function readAllProjects(): Promise<AllProjectsResult> {
  const publicCards = parseCards(await readDirRaws(PROJECTS_DIR), "public");
  const { raws, error } = await loadPrivateRaws();
  const privateCards = parseCards(raws, "private");
  return {
    projects: mergeProjects(publicCards, privateCards),
    privateStoreError: error,
  };
}

async function readLocalRaw(fullPath: string): Promise<string | null> {
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function parseDetail(
  raw: string,
  slug: string,
  store: CardStore,
): Promise<ProjectDetail | null> {
  const { data, content } = matter(raw);
  const parsed = projectFrontmatterSchema.safeParse(normalizeFrontmatter(data));
  if (!parsed.success) {
    console.warn(
      `Project ${slug}.md (${store}) failed schema validation: ` +
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; "),
    );
    return null;
  }
  const processed = await remark().use(html).process(content);
  return { frontmatter: parsed.data, store, body: content, html: processed.toString() };
}

/**
 * Reads a single project by slug — public store first (public wins), then
 * private. Returns null if missing or invalid.
 */
export async function readProject(slug: string): Promise<ProjectDetail | null> {
  // Guard against path traversal — slug must be a plain kebab token.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  const publicRaw = await readLocalRaw(path.join(PROJECTS_DIR, `${slug}.md`));
  if (publicRaw !== null) {
    return parseDetail(publicRaw, slug, "public");
  }

  if (process.env.NODE_ENV === "development") {
    const privateRaw = await readLocalRaw(
      path.join(PRIVATE_PROJECTS_DIR, `${slug}.md`),
    );
    return privateRaw !== null
      ? parseDetail(privateRaw, slug, "private")
      : null;
  }

  let privateRaw: string | null;
  try {
    privateRaw = await fetchPrivateCardRaw(slug);
  } catch (err) {
    console.warn(
      `Private card fetch failed for "${slug}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
  return privateRaw !== null ? parseDetail(privateRaw, slug, "private") : null;
}
