"use client";

import { useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

import type { ProjectFrontmatter } from "@/lib/schema";
import StatusBadge from "@/components/StatusBadge";
import EditableField from "@/components/EditableField";
import KeyBadge from "@/components/KeyBadge";
import {
  FOCUS_PROJECT_EVENT,
  playFocusPop,
  type FocusProjectDetail,
} from "@/lib/focus";
import { useLock } from "@/components/LockProvider";

const MAX_STACK = 4;

export default function ProjectCard({
  project,
  index = 0,
}: {
  project: ProjectFrontmatter;
  index?: number;
}) {
  const { locked } = useLock();

  // Jump-to-card from the Keys popover: scroll into view + highlight. If the
  // card's section is collapsed (inert), wait for it to expand first.
  useEffect(() => {
    function onFocus(e: Event) {
      const detail = (e as CustomEvent<FocusProjectDetail>).detail;
      if (!detail || detail.slug !== project.slug) return;
      const el = document.getElementById(`project-${project.slug}`);
      if (!el) return;
      const collapsed = !!el.closest("[inert]");
      window.setTimeout(
        () => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          playFocusPop(el);
        },
        collapsed ? 360 : 0,
      );
    }
    window.addEventListener(FOCUS_PROJECT_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_PROJECT_EVENT, onFocus);
  }, [project.slug]);

  const visibleStack = project.stack.slice(0, MAX_STACK);
  const overflow = project.stack.length - visibleStack.length;
  const showNextAction =
    project.status === "in-progress" || project.status === "planned";

  // When locked: the whole card is a Link (current behavior).
  // When unlocked: the card is a div; an explicit "Open" arrow at the
  // bottom-right is the only navigator, so editing doesn't fight clicks.
  const Wrapper: React.ElementType = locked ? Link : "div";
  const wrapperProps = locked ? { href: `/projects/${project.slug}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      id={`project-${project.slug}`}
      style={{ "--index": index } as React.CSSProperties}
      className="rise group flex flex-col rounded-xl border border-line bg-surface p-6 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-xl tracking-[-0.02em] text-ink">
          <EditableField
            slug={project.slug}
            field="name"
            type="text"
            initialValue={project.name}
          />
        </h3>
        <div className="flex items-center gap-2">
          {project.api_keys && project.api_keys.length > 0 && (
            <KeyBadge apiKeys={project.api_keys} />
          )}
          <EditableField
            slug={project.slug}
            field="status"
            type="select"
            initialValue={project.status}
            options={["planned", "in-progress", "completed", "archived"]}
            display={(v) => <StatusBadge status={v as ProjectFrontmatter["status"]} />}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        <EditableField
          slug={project.slug}
          field="recruiter_pitch"
          type="textarea"
          initialValue={project.recruiter_pitch}
          optional
          emptyLabel="Add a one-sentence pitch"
        />
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {locked ? (
          <>
            {visibleStack.map((tech) => (
              <span
                key={tech}
                className="rounded-md bg-[#f1f1ef] px-2 py-0.5 font-mono text-[0.7rem] text-muted"
              >
                {tech}
              </span>
            ))}
            {overflow > 0 && (
              <span className="px-1 py-0.5 font-mono text-[0.7rem] text-muted">
                +{overflow} more
              </span>
            )}
          </>
        ) : (
          <span className="font-mono text-[0.75rem] text-muted">
            <EditableField
              slug={project.slug}
              field="stack"
              type="array"
              initialValue={project.stack}
              placeholder="Next.js, TypeScript, ..."
              display={(v) =>
                Array.isArray(v) ? (
                  <span className="flex flex-wrap gap-1.5">
                    {v.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md bg-[#f1f1ef] px-2 py-0.5"
                      >
                        {tech}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="italic">add stack</span>
                )
              }
            />
          </span>
        )}
      </div>

      {(showNextAction || (!locked && project.next_action)) && (
        <p className="mt-4 border-l-2 border-line pl-3 text-sm text-ink">
          <span className="font-medium text-muted">Next: </span>
          <EditableField
            slug={project.slug}
            field="next_action"
            type="textarea"
            initialValue={project.next_action}
            optional={project.status === "completed" || project.status === "archived"}
            emptyLabel="Add the next action"
          />
        </p>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span>
          Last worked{" "}
          <EditableField
            slug={project.slug}
            field="last_worked_on"
            type="date"
            initialValue={project.last_worked_on}
            display={(v) =>
              typeof v === "string" ? format(parseISO(v), "MMM d, yyyy") : "—"
            }
          />
        </span>
        {locked ? (
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        ) : (
          <Link
            href={`/projects/${project.slug}`}
            className="text-ink underline underline-offset-4 hover:text-muted"
          >
            Open &rarr;
          </Link>
        )}
      </div>
    </Wrapper>
  );
}
