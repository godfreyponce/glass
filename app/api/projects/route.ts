import { NextResponse } from "next/server";

import {
  projectFrontmatterSchema,
  projectInputSchema,
  type ProjectFrontmatter,
} from "@/lib/schema";
import { serializeProject } from "@/lib/markdown";
import {
  createProjectFile,
  FileAlreadyExistsError,
  GitHubConfigError,
} from "@/lib/github";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.API_WRITE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server is missing API_WRITE_SECRET." },
      { status: 500 },
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be an object." },
      { status: 400 },
    );
  }

  const { passphrase, ...payload } = body as Record<string, unknown>;
  if (typeof passphrase !== "string" || passphrase !== secret) {
    return NextResponse.json(
      { error: "Invalid or missing passphrase." },
      { status: 401 },
    );
  }

  const parsed = projectInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  const frontmatter: ProjectFrontmatter = { ...parsed.data, slug };

  // Re-validate the final shape (slug now required) before writing.
  const finalCheck = projectFrontmatterSchema.safeParse(frontmatter);
  if (!finalCheck.success) {
    return NextResponse.json(
      {
        error: "Derived slug is invalid; provide a kebab-case slug explicitly.",
      },
      { status: 422 },
    );
  }

  const fileContents = serializeProject(finalCheck.data);

  try {
    await createProjectFile(slug, fileContents);
  } catch (err) {
    if (err instanceof FileAlreadyExistsError) {
      return NextResponse.json(
        { error: `A project with slug "${slug}" already exists.` },
        { status: 409 },
      );
    }
    if (err instanceof GitHubConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("GitHub commit failed:", err);
    return NextResponse.json(
      { error: "Failed to commit the project file to GitHub." },
      { status: 502 },
    );
  }

  return NextResponse.json({ slug }, { status: 201 });
}
