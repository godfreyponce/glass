import { Octokit } from "@octokit/rest";

/**
 * GitHub write layer for the "New Project" form. Commits a new markdown file
 * to content/projects/ in the portfolio repo; the commit triggers a Vercel
 * redeploy and the project appears on the dashboard.
 *
 * Required env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO.
 * Optional env: GITHUB_BRANCH (default "main").
 */

export class GitHubConfigError extends Error {}
export class FileAlreadyExistsError extends Error {}
export class FileNotFoundError extends Error {}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!token || !owner || !repo) {
    throw new GitHubConfigError(
      "Missing GitHub config. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.",
    );
  }

  return { token, owner, repo, branch };
}

/**
 * Creates content/projects/<slug>.md in the repo. Rejects (does not clobber)
 * if a file already exists at that path.
 */
export async function createProjectFile(
  slug: string,
  fileContents: string,
): Promise<{ commitUrl: string }> {
  const { token, owner, repo, branch } = getConfig();
  const octokit = new Octokit({ auth: token });
  const filePath = `content/projects/${slug}.md`;

  // Refuse to overwrite an existing project file.
  try {
    await octokit.repos.getContent({ owner, repo, path: filePath, ref: branch });
    throw new FileAlreadyExistsError(
      `A project already exists at ${filePath}.`,
    );
  } catch (err) {
    if (err instanceof FileAlreadyExistsError) throw err;
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
    // 404 => path is free, proceed.
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    branch,
    message: `feat: add ${slug} project`,
    content: Buffer.from(fileContents, "utf8").toString("base64"),
  });

  return { commitUrl: res.data.commit.html_url ?? "" };
}

/**
 * Overwrites content/projects/<slug>.md in the repo. Requires the file to
 * already exist (we don't want a PATCH to silently create new projects;
 * that's what the POST path is for).
 */
export async function updateProjectFile(
  slug: string,
  fileContents: string,
): Promise<{ commitUrl: string }> {
  const { token, owner, repo, branch } = getConfig();
  const octokit = new Octokit({ auth: token });
  const filePath = `content/projects/${slug}.md`;

  // Fetch existing SHA so the API treats this as an update, not a create.
  let sha: string;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if (Array.isArray(existing.data) || existing.data.type !== "file") {
      throw new FileNotFoundError(
        `Path ${filePath} is not a file in the repo.`,
      );
    }
    sha = existing.data.sha;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      throw new FileNotFoundError(
        `No project file exists at ${filePath} to update.`,
      );
    }
    throw err;
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    branch,
    sha,
    message: `chore: update ${slug} project`,
    content: Buffer.from(fileContents, "utf8").toString("base64"),
  });

  return { commitUrl: res.data.commit.html_url ?? "" };
}
