import { NextResponse } from "next/server";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

import {
  projectFrontmatterSchema,
  projectPatchSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";
import { persistProjectFile, readCurrentProject } from "@/lib/persist";

/**
 * PATCH /api/projects/[slug]
 *
 * Headers:
 *   x-passphrase: must equal process.env.API_WRITE_SECRET
 *
 * Body: a JSON object matching `projectPatchSchema`. Every field is optional;
 *   optional fields may be `null` to clear them; unknown keys are rejected.
 *   `slug` is not patchable.
 *
 * Persistence is hybrid: dev writes to disk (instant), prod commits to GitHub
 * (~45-90s redeploy lag). Response indicates which mode happened.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const secret = process.env.API_WRITE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server is missing API_WRITE_SECRET." },
      { status: 500 },
    );
  }

  const passphrase = request.headers.get("x-passphrase");
  if (passphrase !== secret) {
    return NextResponse.json(
      { error: "Invalid or missing passphrase." },
      { status: 401 },
    );
  }

  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
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

  const patchResult = projectPatchSchema.safeParse(body);
  if (!patchResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: patchResult.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  // Pull `body` out of the patch — it's not a frontmatter field.
  const { body: newBody, ...frontmatterPatch } = patchResult.data;

  const current = await readCurrentProject(slug);
  if (!current) {
    return NextResponse.json(
      { error: `No project found at slug "${slug}".` },
      { status: 404 },
    );
  }

  // Merge: null = clear, value = set, omitted = leave unchanged.
  const merged: Record<string, unknown> = { ...current.frontmatter };
  for (const [key, value] of Object.entries(frontmatterPatch)) {
    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      merged[key] = value;
    }
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
  const nextFrontmatter: ProjectFrontmatter = finalCheck.data;

  // Reassemble the file: new frontmatter + new-or-current body.
  const data = Object.fromEntries(
    Object.entries(nextFrontmatter).filter(([, v]) => v !== undefined),
  );
  const finalBody = newBody !== undefined ? newBody : current.body;
  const fileContents = matter.stringify(`\n${finalBody.trim()}\n`, data);

  try {
    const result = await persistProjectFile(slug, fileContents);
    // Pre-render the body so the client can show the new content immediately,
    // even in prod where the deployed build hasn't redeployed yet.
    const renderedHtml = (
      await remark().use(remarkHtml).process(finalBody)
    ).toString();
    return NextResponse.json({
      slug,
      frontmatter: nextFrontmatter,
      body: finalBody,
      html: renderedHtml,
      persistence: result.mode,
      ...(result.mode === "github" ? { commitUrl: result.commitUrl } : {}),
    });
  } catch (err) {
    console.error(`PATCH ${slug} failed:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to persist the project file.",
      },
      { status: 500 },
    );
  }
}
