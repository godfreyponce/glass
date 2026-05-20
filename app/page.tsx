import Link from "next/link";

import { readAllProjects } from "@/lib/projects";
import type { ProjectFrontmatter, ProjectStatus } from "@/lib/schema";
import ProjectCard from "@/components/ProjectCard";
import ProjectSection from "@/components/ProjectSection";
import PlannedSketch from "@/components/PlannedSketch";
import LockToggle from "@/components/LockToggle";
import RedeployBanner from "@/components/RedeployBanner";
import { isAvailable as quickAddAvailable } from "@/lib/claude-code";

const SECTIONS: {
  status: ProjectStatus;
  title: string;
  defaultOpen: boolean;
  /** When true, the section renders even if it has no items (used for Planned). */
  alwaysRender?: boolean;
}[] = [
  { status: "in-progress", title: "In Progress", defaultOpen: true },
  {
    status: "planned",
    title: "Planned",
    defaultOpen: false,
    alwaysRender: true,
  },
  { status: "completed", title: "Completed", defaultOpen: false },
];

/** Sparkle glyph for the dev-only "Quick" button. */
function SparkleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 1.5 L8 5 L11.5 6 L8 7 L7 10.5 L6 7 L2.5 6 L6 5 Z" />
      <path d="M11 10.5 L11.5 12 L13 12.5 L11.5 13 L11 14" transform="translate(-1 -1.5)" />
    </svg>
  );
}

/** Tiny inline paper-plane glyph next to the "PLANNED" section header. */
function PlannedHeaderIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 L2 6 L6 8.2 L5 12 Z" />
      <path d="M12 2 L6 8.2" />
    </svg>
  );
}

function PlannedEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <PlannedSketch className="h-28 w-auto" />
      <div className="max-w-sm">
        <p className="font-serif text-lg tracking-[-0.01em] text-ink">
          Nothing planned yet.
        </p>
        <p className="mt-1 text-sm text-muted">
          Ideas live here.{" "}
          <Link
            href="/new"
            className="text-ink underline underline-offset-4 hover:text-muted"
          >
            Add one
          </Link>{" "}
          to start tracking what&apos;s next.
        </p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const projects = await readAllProjects();

  const byStatus = (status: ProjectStatus): ProjectFrontmatter[] =>
    projects.filter((p) => p.status === status);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
      <header className="rise flex flex-col gap-6 border-b border-line pb-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-serif text-4xl tracking-[-0.03em] text-ink sm:text-5xl">
            Glass
          </h1>
          <p className="mt-3 text-base text-muted">
            A single pane of glass over every project: planned, in progress,
            and completed. Each entry is a markdown file; this is the view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LockToggle />
          {quickAddAvailable() && (
            <Link
              href="/new/quick"
              title="Describe a project; Claude Code writes the file (dev only, uses your MAX plan)"
              className="inline-flex w-fit items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:bg-[#f7f6f3] active:scale-[0.98]"
            >
              <SparkleIcon />
              Quick
            </Link>
          )}
          <Link
            href="/new"
            className="inline-flex w-fit items-center gap-2 rounded-[6px] bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98]"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            New Project
          </Link>
        </div>
      </header>
      <RedeployBanner />

      {projects.length === 0 && (
        <p className="mt-16 text-sm text-muted">
          No projects yet. Add a markdown file to{" "}
          <code className="font-mono text-xs">content/projects/</code> or use
          the New Project form.
        </p>
      )}

      {SECTIONS.map(({ status, title, defaultOpen, alwaysRender }) => {
        const items = byStatus(status);
        if (items.length === 0 && !alwaysRender) return null;
        const isPlanned = status === "planned";
        return (
          <ProjectSection
            key={status}
            title={title}
            count={items.length}
            defaultOpen={defaultOpen}
            icon={isPlanned ? <PlannedHeaderIcon /> : undefined}
          >
            {items.length === 0 && isPlanned ? (
              <PlannedEmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {items.map((project, i) => (
                  <ProjectCard key={project.slug} project={project} index={i} />
                ))}
              </div>
            )}
          </ProjectSection>
        );
      })}
    </div>
  );
}
