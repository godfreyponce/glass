import path from "path";
import { describe, expect, it } from "vitest";

import { localCardPath } from "@/lib/persist";

describe("localCardPath", () => {
  it("routes public cards to content/projects/", () => {
    expect(localCardPath("public", "kal")).toBe(
      path.join(process.cwd(), "content", "projects", "kal.md"),
    );
  });

  it("routes private cards to content/private/projects/", () => {
    expect(localCardPath("private", "climbing")).toBe(
      path.join(process.cwd(), "content", "private", "projects", "climbing.md"),
    );
  });
});
