import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { Octokit } from "@octokit/rest";

import { updateProjectFile } from "@/lib/github";
import { normalizeFrontmatter } from "@/lib/markdown";
import {
  projectFrontmatterSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";

/**
 * Write a project's markdown file. Hybrid strategy:
 *  - development: write directly to the local content/projects/<slug>.md
 *    so the dev server's HMR picks it up immediately (~1s).
 *  - production: commit to the GitHub repo via Octokit; Vercel rebuilds
 *    and the deployed site catches up in ~45-90s.
 *
 * Returns a discriminated result so callers can tell the client what kind
 * of latency to expect.
 */
export type PersistResult =
  | { mode: "local"; commitUrl?: never }
  | { mode: "github"; commitUrl: string };

export async function persistProjectFile(
  slug: string,
  fileContents: string,
): Promise<PersistResult> {
  if (process.env.NODE_ENV === "development") {
    const filePath = path.join(
      process.cwd(),
      "content",
      "projects",
      `${slug}.md`,
    );
    await fs.writeFile(filePath, fileContents, "utf8");
    return { mode: "local" };
  }

  const { commitUrl } = await updateProjectFile(slug, fileContents);
  return { mode: "github", commitUrl };
}

export interface CurrentProject {
  frontmatter: ProjectFrontmatter;
  body: string;
}

/**
 * Read the *latest* version of a project. In dev, that's the local file.
 * In prod, we fetch from GitHub directly rather than the bundled-at-build
 * filesystem, so concurrent edits don't clobber each other through a stale
 * deploy.
 */
export async function readCurrentProject(
  slug: string,
): Promise<CurrentProject | null> {
  if (process.env.NODE_ENV === "development") {
    return readLocalProject(slug);
  }
  return readProjectFromGitHub(slug);
}

async function readLocalProject(slug: string): Promise<CurrentProject | null> {
  const filePath = path.join(
    process.cwd(),
    "content",
    "projects",
    `${slug}.md`,
  );
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return parseRaw(raw);
}

async function readProjectFromGitHub(
  slug: string,
): Promise<CurrentProject | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub env not configured (need GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO).",
    );
  }

  const octokit = new Octokit({ auth: token });
  const filePath = `content/projects/${slug}.md`;
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    const raw = Buffer.from(res.data.content, "base64").toString("utf8");
    return parseRaw(raw);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

function parseRaw(raw: string): CurrentProject | null {
  const { data, content } = matter(raw);
  const parsed = projectFrontmatterSchema.safeParse(normalizeFrontmatter(data));
  if (!parsed.success) return null;
  return { frontmatter: parsed.data, body: content };
}
