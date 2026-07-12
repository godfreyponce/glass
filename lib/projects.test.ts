import { describe, expect, it, vi } from "vitest";

import { mergeProjects, type ProjectWithSource } from "@/lib/projects";

function card(
  slug: string,
  store: "public" | "private",
  last: string,
): ProjectWithSource {
  return {
    slug,
    name: slug,
    status: "completed",
    priority: "medium",
    stack: ["TypeScript"],
    started: "2026-01-01",
    last_worked_on: last,
    store,
  };
}

describe("mergeProjects", () => {
  it("includes cards from both stores, sorted by last_worked_on desc", () => {
    const merged = mergeProjects(
      [card("alpha", "public", "2026-07-01")],
      [card("bravo", "private", "2026-07-10")],
    );
    expect(merged.map((p) => p.slug)).toEqual(["bravo", "alpha"]);
    expect(merged[0].store).toBe("private");
  });

  it("drops the private card on slug collision (public wins) and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const merged = mergeProjects(
      [card("dupe", "public", "2026-07-01")],
      [card("dupe", "private", "2026-07-10"), card("solo", "private", "2026-06-01")],
    );
    expect(merged.map((p) => p.slug)).toEqual(["dupe", "solo"]);
    expect(merged[0].store).toBe("public");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
