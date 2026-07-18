import { Octokit } from "@octokit/rest";

/**
 * Read/write access to the PRIVATE card store: a separate private GitHub repo
 * (GITHUB_PRIVATE_REPO) holding projects/*.md. Used only in production — in
 * dev, the store is the local clone at content/private/ and never goes
 * through this module. Unconfigured (env unset) means "no private store":
 * reads return empty, writes throw.
 */

const CARDS_DIR = "projects";

export interface PrivateStoreConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export function getPrivateConfig(
  env: NodeJS.ProcessEnv = process.env,
): PrivateStoreConfig | null {
  const token = env.GITHUB_TOKEN;
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_PRIVATE_REPO;
  if (!token || !owner || !repo) {
    return null;
  }
  return { token, owner, repo, branch: env.GITHUB_BRANCH ?? "main" };
}

/** Lists and downloads every private card. Throws on API failure so callers
 *  can surface an error state instead of silently dropping cards. */
export async function fetchPrivateRaws(): Promise<
  { file: string; raw: string }[]
> {
  const cfg = getPrivateConfig();
  if (!cfg) {
    return [];
  }
  const octokit = new Octokit({ auth: cfg.token });

  let listing;
  try {
    listing = await octokit.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: CARDS_DIR,
      ref: cfg.branch,
    });
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      return []; // projects/ dir not created yet — an empty store, not an error
    }
    throw err;
  }
  if (!Array.isArray(listing.data)) {
    return [];
  }

  const files = listing.data.filter(
    (e) => e.type === "file" && e.name.endsWith(".md"),
  );
  return Promise.all(
    files.map(async (e) => {
      const res = await octokit.repos.getContent({
        owner: cfg.owner,
        repo: cfg.repo,
        path: e.path,
        ref: cfg.branch,
      });
      if (Array.isArray(res.data) || res.data.type !== "file") {
        throw new Error(`Unexpected content shape for ${e.path}`);
      }
      return {
        file: e.name,
        raw: Buffer.from(res.data.content, "base64").toString("utf8"),
      };
    }),
  );
}

/** Fetches one private card's raw markdown, or null if absent/unconfigured. */
export async function fetchPrivateCardRaw(slug: string): Promise<string | null> {
  const cfg = getPrivateConfig();
  if (!cfg) {
    return null;
  }
  const octokit = new Octokit({ auth: cfg.token });
  try {
    const res = await octokit.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: `${CARDS_DIR}/${slug}.md`,
      ref: cfg.branch,
    });
    if (Array.isArray(res.data) || res.data.type !== "file") {
      return null;
    }
    return Buffer.from(res.data.content, "base64").toString("utf8");
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/** Commits a private card (create or update) to the private repo. */
export async function commitPrivateCard(
  slug: string,
  fileContents: string,
): Promise<{ commitUrl: string }> {
  const cfg = getPrivateConfig();
  if (!cfg) {
    throw new Error(
      "Private store is not configured (set GITHUB_PRIVATE_REPO).",
    );
  }
  const octokit = new Octokit({ auth: cfg.token });
  const filePath = `${CARDS_DIR}/${slug}.md`;

  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: filePath,
      ref: cfg.branch,
    });
    if (!Array.isArray(existing.data) && existing.data.type === "file") {
      sha = existing.data.sha;
    }
  } catch (err) {
    if ((err as { status?: number }).status !== 404) {
      throw err;
    }
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner: cfg.owner,
    repo: cfg.repo,
    path: filePath,
    branch: cfg.branch,
    message: `chore: update private card ${slug}`,
    content: Buffer.from(fileContents, "utf8").toString("base64"),
    sha,
  });
  return { commitUrl: res.data.commit.html_url ?? "" };
}
