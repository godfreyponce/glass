import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { readAllProjects, readProject } from "@/lib/projects";
import EscToGoBack from "@/components/EscToGoBack";
import EditableDetailView from "@/components/EditableDetailView";
import EditableBody from "@/components/EditableBody";
import LockToggle from "@/components/LockToggle";
import RedeployBanner from "@/components/RedeployBanner";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { projects } = await readAllProjects();
  return projects
    .filter((p) => p.store === "public")
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await readProject(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.frontmatter.name} — Glass`,
    description: project.frontmatter.recruiter_pitch,
  };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const project = await readProject(slug);
  if (!project) notFound();

  const { frontmatter, body, html } = project;
  const showPrivate = (await searchParams).private === "1";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <EscToGoBack />
      <RedeployBanner />
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          &larr; All projects
        </Link>
        <LockToggle />
      </div>

      <EditableDetailView
        frontmatter={frontmatter}
        showPrivate={showPrivate}
      />

      <EditableBody
        slug={frontmatter.slug}
        initialBody={body}
        initialHtml={html}
      />
    </div>
  );
}
