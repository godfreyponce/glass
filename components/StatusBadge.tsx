import type { ProjectStatus } from "@/lib/schema";

const STYLES: Record<ProjectStatus, { bg: string; fg: string; label: string }> =
  {
    "in-progress": {
      bg: "bg-status-progress-bg",
      fg: "text-status-progress-fg",
      label: "In Progress",
    },
    planned: {
      bg: "bg-status-planned-bg",
      fg: "text-status-planned-fg",
      label: "Planned",
    },
    completed: {
      bg: "bg-status-completed-bg",
      fg: "text-status-completed-fg",
      label: "Completed",
    },
    archived: {
      bg: "bg-status-archived-bg",
      fg: "text-status-archived-fg",
      label: "Archived",
    },
  };

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.08em] ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}
