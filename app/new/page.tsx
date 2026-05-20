import Link from "next/link";
import type { Metadata } from "next";

import NewProjectForm from "@/components/NewProjectForm";
import EscToGoBack from "@/components/EscToGoBack";

export const metadata: Metadata = {
  title: "New Project — Glass",
};

export default function NewProjectPage() {
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
          New Project
        </h1>
        <p className="mt-3 text-sm text-muted">
          Submitting commits a markdown file to{" "}
          <code className="font-mono text-xs">content/projects/</code> via the
          GitHub API. Vercel redeploys and the project appears on the dashboard.
        </p>
      </header>

      <NewProjectForm />
    </div>
  );
}
