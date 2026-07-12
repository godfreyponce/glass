import Link from "next/link";
import type { Metadata } from "next";

import QuickTabs from "@/components/QuickTabs";
import EscToGoBack from "@/components/EscToGoBack";
import { isAvailable } from "@/lib/claude-code";
import { readAllProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Quick add — Glass",
};

export default async function QuickAddPage() {
  const dev = isAvailable();
  const projects = dev
    ? (await readAllProjects()).projects.map((p) => ({
        slug: p.slug,
        name: p.name,
        status: p.status,
        last_worked_on: p.last_worked_on,
        next_action: p.next_action,
      }))
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20 sm:py-28">
      <EscToGoBack />
      <Link
        href="/"
        className="text-sm text-muted underline underline-offset-4 hover:text-ink"
      >
        &larr; All projects
      </Link>

      <header className="rise mt-8 border-b border-line pb-8">
        <h1 className="font-serif text-4xl tracking-[-0.03em] text-ink">
          Quick add
        </h1>
        <p className="mt-3 text-sm text-muted">
          Describe a project in plain language. Your local Claude Code reads
          the schema, writes the markdown file, and the card appears.
        </p>
      </header>

      {dev ? (
        <QuickTabs projects={projects} />
      ) : (
        <div className="rise mt-10 rounded-[8px] border border-line bg-surface p-6 text-sm text-muted">
          <p className="text-ink">This feature only runs in local development.</p>
          <p className="mt-2">
            It spawns Claude Code (the CLI) on the machine running the dev
            server, authenticated against your MAX plan. The deployed site
            can&apos;t do that — there&apos;s no `claude` binary on Vercel and
            no access to your OAuth login.
          </p>
          <p className="mt-2">
            Use{" "}
            <Link
              href="/new"
              className="text-ink underline underline-offset-4 hover:text-muted"
            >
              the manual form
            </Link>{" "}
            instead, or run the app locally.
          </p>
        </div>
      )}
    </div>
  );
}
