"use client";

import { format, parseISO } from "date-fns";

import type { ProjectFrontmatter } from "@/lib/schema";
import StatusBadge from "@/components/StatusBadge";
import EditableField from "@/components/EditableField";
import ProviderLogo from "@/components/ProviderLogo";
import { providerLabel } from "@/lib/keys";
import { useLock } from "@/components/LockProvider";

const STATUS_OPTIONS = [
  "planned",
  "in-progress",
  "completed",
  "archived",
] as const;
const PRIORITY_OPTIONS = ["high", "medium", "low"] as const;

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-line py-3 text-sm">
      <dt className="font-medium uppercase tracking-[0.06em] text-muted text-xs pt-0.5">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export default function EditableDetailView({
  frontmatter: fm,
  showPrivate,
}: {
  frontmatter: ProjectFrontmatter;
  showPrivate: boolean;
}) {
  const { locked } = useLock();

  return (
    <>
      <header className="rise mt-8 border-b border-line pb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-serif text-4xl tracking-[-0.03em] text-ink">
            <EditableField
              slug={fm.slug}
              field="name"
              type="text"
              initialValue={fm.name}
            />
          </h1>
          <EditableField
            slug={fm.slug}
            field="status"
            type="select"
            initialValue={fm.status}
            options={STATUS_OPTIONS}
            display={(v) => (
              <StatusBadge status={v as ProjectFrontmatter["status"]} />
            )}
          />
        </div>
        <p className="mt-4 text-base text-muted">
          <EditableField
            slug={fm.slug}
            field="recruiter_pitch"
            type="textarea"
            initialValue={fm.recruiter_pitch}
            optional
            emptyLabel="Add a one-sentence pitch"
          />
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-muted">
          <span>
            Started{" "}
            <EditableField
              slug={fm.slug}
              field="started"
              type="date"
              initialValue={fm.started}
              display={(v) =>
                typeof v === "string" ? format(parseISO(v), "MMM d, yyyy") : "—"
              }
            />
          </span>
          <span>
            Last worked{" "}
            <EditableField
              slug={fm.slug}
              field="last_worked_on"
              type="date"
              initialValue={fm.last_worked_on}
              display={(v) =>
                typeof v === "string" ? format(parseISO(v), "MMM d, yyyy") : "—"
              }
            />
          </span>
          <span className="uppercase tracking-[0.06em]">
            <EditableField
              slug={fm.slug}
              field="priority"
              type="select"
              initialValue={fm.priority}
              options={PRIORITY_OPTIONS}
            />{" "}
            priority
          </span>
        </div>
      </header>

      <dl className="rise mt-8">
        <MetaRow label="Stack">
          <EditableField
            slug={fm.slug}
            field="stack"
            type="array"
            initialValue={fm.stack}
            placeholder="Next.js, TypeScript, ..."
            display={(v) =>
              Array.isArray(v) && v.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {v.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md bg-[#f1f1ef] px-2 py-0.5 font-mono text-[0.7rem] text-muted"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="italic text-muted">no stack</span>
              )
            }
          />
        </MetaRow>

        {(fm.next_action || !locked) && (
          <MetaRow label="Next action">
            <EditableField
              slug={fm.slug}
              field="next_action"
              type="textarea"
              initialValue={fm.next_action}
              optional={fm.status === "completed" || fm.status === "archived"}
              emptyLabel="Add the next action"
            />
          </MetaRow>
        )}

        {(fm.run_command || !locked) && (
          <MetaRow label="Run">
            <EditableField
              slug={fm.slug}
              field="run_command"
              type="text"
              initialValue={fm.run_command}
              optional
              placeholder="npm run dev"
              emptyLabel="Add a run command"
              display={(v) =>
                typeof v === "string" && v.length > 0 ? (
                  <code className="rounded bg-[#f1f1ef] px-1.5 py-0.5 font-mono text-[0.8rem]">
                    {v}
                  </code>
                ) : (
                  <span className="italic text-muted">none</span>
                )
              }
            />
          </MetaRow>
        )}

        {(fm.entry_point || !locked) && (
          <MetaRow label="Entry point">
            <EditableField
              slug={fm.slug}
              field="entry_point"
              type="text"
              initialValue={fm.entry_point}
              optional
              placeholder="app/page.tsx"
              emptyLabel="Add an entry point"
              display={(v) =>
                typeof v === "string" && v.length > 0 ? (
                  <code className="font-mono text-[0.8rem]">{v}</code>
                ) : (
                  <span className="italic text-muted">none</span>
                )
              }
            />
          </MetaRow>
        )}

        <MetaRow label="Repo URL">
          <EditableField
            slug={fm.slug}
            field="repo_url"
            type="url"
            initialValue={fm.repo_url}
            optional
            placeholder="https://github.com/..."
            emptyLabel="Add a repo URL"
            display={(v) =>
              typeof v === "string" && v.length > 0 ? (
                <a
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-4 hover:text-muted"
                >
                  Repository
                </a>
              ) : (
                <span className="italic text-muted">none</span>
              )
            }
          />
        </MetaRow>

        <MetaRow label="Live URL">
          <EditableField
            slug={fm.slug}
            field="live_url"
            type="url"
            initialValue={fm.live_url}
            optional
            placeholder="https://..."
            emptyLabel="Add a live URL"
            display={(v) =>
              typeof v === "string" && v.length > 0 ? (
                <a
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-4 hover:text-muted"
                >
                  Live site
                </a>
              ) : (
                <span className="italic text-muted">none</span>
              )
            }
          />
        </MetaRow>

        <MetaRow label="Tags">
          <EditableField
            slug={fm.slug}
            field="tags"
            type="array"
            initialValue={fm.tags}
            optional
            placeholder="ai, freelance, ..."
            emptyLabel="Add tags"
            display={(v) =>
              Array.isArray(v) && v.length > 0 ? (
                <span className="text-muted">{v.join(", ")}</span>
              ) : (
                <span className="italic text-muted">none</span>
              )
            }
          />
        </MetaRow>

        {fm.api_keys && fm.api_keys.length > 0 && (
          <MetaRow label="API keys">
            <ul className="flex flex-col gap-2">
              {fm.api_keys.map((k, i) => (
                <li
                  key={`${k.provider}-${i}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <ProviderLogo provider={k.provider} box="h-[20px] w-[20px]" />
                  <span className="text-ink">{providerLabel(k.provider)}</span>
                  {k.label && (
                    <span className="rounded bg-[#f1f1ef] px-1.5 py-0.5 text-[0.72rem] text-muted">
                      {k.label}
                    </span>
                  )}
                  <span className="text-muted">·</span>
                  <span className="text-muted">{k.location}</span>
                  {k.env_var && (
                    <code className="rounded bg-[#f1f1ef] px-1.5 py-0.5 font-mono text-[0.72rem] text-muted">
                      {k.env_var}
                    </code>
                  )}
                </li>
              ))}
            </ul>
          </MetaRow>
        )}

        {showPrivate && (
          <MetaRow label="Local path">
            <EditableField
              slug={fm.slug}
              field="local_path"
              type="text"
              initialValue={fm.local_path}
              optional
              placeholder="~/projects/..."
              emptyLabel="Add a local path"
              display={(v) =>
                typeof v === "string" && v.length > 0 ? (
                  <code className="font-mono text-[0.8rem] text-muted">
                    {v}
                  </code>
                ) : (
                  <span className="italic text-muted">none</span>
                )
              }
            />
          </MetaRow>
        )}
      </dl>
    </>
  );
}
