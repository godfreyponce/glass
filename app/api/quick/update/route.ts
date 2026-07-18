import { NextResponse } from "next/server";
import matter from "gray-matter";

import { isAvailable } from "@/lib/claude-code";
import { readCurrentProject, persistProjectFile } from "@/lib/persist";
import { readGlassState } from "@/lib/glass-md";
import { projectFrontmatterSchema } from "@/lib/schema";

/**
 * POST /api/quick/update — DEV-ONLY.
 *
 * Reads a project's root-level glass.md (located via the card's local_path) and
 * syncs ONLY status / last_worked_on / next_action onto the card.
 *  - Default: returns a { current, proposed } preview, no mutation.
 *  - With { apply: true }: writes the three-field patch and persists the file.
 *
 * No Claude spawn — glass.md is already structured, so this is a deterministic
 * read → validate → patch. Production responds 503 (it reads the local FS).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: Request): Promise<Response> {
  if (!isAvailable()) {
    return NextResponse.json(
      {
        error:
          "Update state is a dev-only feature — it reads glass.md from your local project folders, which the deployed site can't access.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const slug = (body as { slug?: unknown }).slug;
  const apply = (body as { apply?: unknown }).apply === true;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug." }, { status: 400 });
  }

  const current = await readCurrentProject(slug);
  if (!current) {
    return NextResponse.json(
      { error: `No project found at slug "${slug}".` },
      { status: 404 },
    );
  }

  const localPath = current.frontmatter.local_path;
  if (!localPath) {
    return NextResponse.json(
      { error: `Card "${slug}" has no local_path, so its glass.md can't be located.` },
      { status: 400 },
    );
  }

  const result = await readGlassState(localPath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  const state = result.state;

  if (state.slug !== slug) {
    return NextResponse.json(
      {
        error: `glass.md declares slug "${state.slug}" but you're updating card "${slug}". Fix the slug in glass.md.`,
      },
      { status: 409 },
    );
  }

  const proposed = {
    status: state.status,
    last_worked_on: state.last_worked_on,
    ...(state.next_action !== undefined ? { next_action: state.next_action } : {}),
  };
  const currentTriple = {
    status: current.frontmatter.status,
    last_worked_on: current.frontmatter.last_worked_on,
    ...(current.frontmatter.next_action !== undefined
      ? { next_action: current.frontmatter.next_action }
      : {}),
  };

  if (!apply) {
    return NextResponse.json({ slug, current: currentTriple, proposed });
  }

  // Apply: overlay ONLY the three state fields onto the current frontmatter.
  const merged: Record<string, unknown> = { ...current.frontmatter };
  merged.status = state.status;
  merged.last_worked_on = state.last_worked_on;
  if (state.next_action !== undefined) {
    merged.next_action = state.next_action;
  } else {
    delete merged.next_action;
  }

  const finalCheck = projectFrontmatterSchema.safeParse(merged);
  if (!finalCheck.success) {
    return NextResponse.json(
      {
        error: "Merged result failed validation.",
        issues: finalCheck.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const data = Object.fromEntries(
    Object.entries(finalCheck.data).filter(([, v]) => v !== undefined),
  );
  const fileContents = matter.stringify(`\n${current.body.trim()}\n`, data);

  try {
    const persistResult = await persistProjectFile(slug, fileContents, current.store);
    return NextResponse.json({ slug, applied: proposed, persistence: persistResult.mode });
  } catch (err) {
    console.error(`Update ${slug} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to persist the project file." },
      { status: 500 },
    );
  }
}
