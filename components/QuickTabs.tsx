"use client";

import { useState } from "react";

import QuickChat from "@/components/QuickChat";
import QuickUpdate, { type ProjectOption } from "@/components/QuickUpdate";

export default function QuickTabs({ projects }: { projects: ProjectOption[] }) {
  const [tab, setTab] = useState<"add" | "update">("add");

  const tabClass = (active: boolean) =>
    `rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-[#111111] text-white" : "border border-line bg-surface text-ink hover:bg-[#f7f6f3]"
    }`;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "add"}
          onClick={() => setTab("add")}
          className={tabClass(tab === "add")}
        >
          Add
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "update"}
          onClick={() => setTab("update")}
          className={tabClass(tab === "update")}
        >
          Update state
        </button>
      </div>

      {tab === "add" ? <QuickChat /> : <QuickUpdate projects={projects} />}
    </div>
  );
}
