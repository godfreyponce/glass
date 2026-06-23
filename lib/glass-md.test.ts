import { describe, it, expect } from "vitest";
import { parseGlassState } from "@/lib/glass-md";

const file = (fm: string) => `---\n${fm}\n---\nA progress note.\n`;

describe("parseGlassState", () => {
  it("parses a valid completed glass.md (next_action optional)", () => {
    const r = parseGlassState(
      file('slug: clyde-mochi\nstatus: completed\nlast_worked_on: "2026-06-22"'),
    );
    expect(r).toEqual({
      ok: true,
      state: { slug: "clyde-mochi", status: "completed", last_worked_on: "2026-06-22" },
    });
  });

  it("parses an in-progress glass.md with next_action", () => {
    const r = parseGlassState(
      file('slug: kal\nstatus: in-progress\nlast_worked_on: "2026-06-20"\nnext_action: "Wire up auth"'),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.next_action).toBe("Wire up auth");
  });

  it("normalizes an unquoted YAML date to a string", () => {
    const r = parseGlassState(file("slug: kal\nstatus: completed\nlast_worked_on: 2026-06-22"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.last_worked_on).toBe("2026-06-22");
  });

  it("rejects an unknown status", () => {
    const r = parseGlassState(file('slug: kal\nstatus: shipping\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/status/);
  });

  it("rejects in-progress without next_action", () => {
    const r = parseGlassState(file('slug: kal\nstatus: in-progress\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/next_action/);
  });

  it("rejects a non-kebab slug", () => {
    const r = parseGlassState(file('slug: Clyde_Mochi\nstatus: completed\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/slug/);
  });

  it("rejects a malformed date", () => {
    const r = parseGlassState(file('slug: kal\nstatus: completed\nlast_worked_on: "June 22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/last_worked_on/);
  });
});
