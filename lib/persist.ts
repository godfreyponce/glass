import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { Octokit } from "@octokit/rest";

import { updateProjectFile } from "@/lib/github";
import { normalizeFrontmatter } from "@/lib/markdown";
import { commitPrivateCard, fetchPrivateCardRaw } from "@/lib/private-store";
import type { CardStore } from "@/lib/projects";
import {
  projectFrontmatterSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";

/**
 * Write a project's markdown file. Hybrid strategy, routed by store:
 *  - development: write to the local file (public: content/projects/,
 *    private: content/private/projects/) so HMR picks it up immediately.
 *  - production: commit via Octokit — public cards to the portfolio repo
 *    (triggers a Vercel redeploy), private cards to GITHUB_PRIVATE_REPO
 *    (picked up by the 60s ISR revalidate, no redeploy).
 */
export type PersistResult =
  | { mode: "local"; commitUrl?: never }
  | { mode: "github"; commitUrl: string };

export function localCardPath(store: CardStore, slug: string): string {
  return store === "public"
    ? path.join(process.cwd(), "content", "projects", `${slug}.md`)
    : path.join(process.cwd(), "content", "private", "projects", `${slug}.md`);
}

export async function persistProjectFile(
  slug: string,
  fileContents: string,
  store: CardStore,
): Promise<PersistResult> {
  if (process.env.NODE_ENV === "development") {
    await fs.writeFile(localCardPath(store, slug), fileContents, "utf8");
    return { mode: "local" };
  }

  if (store === "private") {
    const { commitUrl } = await commitPrivateCard(slug, fileContents);
    return { mode: "github", commitUrl };
  }
  const { commitUrl } = await updateProjectFile(slug, fileContents);
  return { mode: "github", commitUrl };
}

export interface CurrentProject {
  frontmatter: ProjectFrontmatter;
  body: string;
  store: CardStore;
}

/**
 * Read the *latest* version of a project, checking the public store first
 * (public wins slug collisions, matching the read layer). In dev that's the
 * local files; in prod we fetch from GitHub directly rather than the
 * bundled-at-build filesystem, so concurrent edits don't clobber each other
 * through a stale deploy.
 */
export async function readCurrentProject(
  slug: string,
): Promise<CurrentProject | null> {
  if (process.env.NODE_ENV === "development") {
    const pub = await readLocalCard(localCardPath("public", slug), "public");
    if (pub) {
      return pub;
    }
    return readLocalCard(localCardPath("private", slug), "private");
  }

  const pub = await readPublicFromGitHub(slug);
  if (pub) {
    return pub;
  }
  const privateRaw = await fetchPrivateCardRaw(slug);
  return privateRaw !== null ? parseRaw(privateRaw, "private") : null;
}

async function readLocalCard(
  filePath: string,
  store: CardStore,
): Promise<CurrentProject | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
  return parseRaw(raw, store);
}

async function readPublicFromGitHub(
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
    if (Array.isArray(res.data) || res.data.type !== "file") {
      return null;
    }
    const raw = Buffer.from(res.data.content, "base64").toString("utf8");
    return parseRaw(raw, "public");
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      return null;
    }
    throw err;
  }
}

function parseRaw(raw: string, store: CardStore): CurrentProject | null {
  const { data, content } = matter(raw);
  const parsed = projectFrontmatterSchema.safeParse(normalizeFrontmatter(data));
  if (!parsed.success) {
    return null;
  }
  return { frontmatter: parsed.data, body: content, store };
}
