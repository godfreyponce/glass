import { describe, expect, it } from "vitest";

import { getPrivateConfig } from "@/lib/private-store";

const BASE = {
  GITHUB_TOKEN: "t",
  GITHUB_OWNER: "godfreyponce",
} as unknown as NodeJS.ProcessEnv;

describe("getPrivateConfig", () => {
  it("returns null when GITHUB_PRIVATE_REPO is unset or empty", () => {
    expect(getPrivateConfig(BASE)).toBeNull();
    expect(getPrivateConfig({ ...BASE, GITHUB_PRIVATE_REPO: "" })).toBeNull();
  });

  it("returns config with the shared branch default", () => {
    expect(
      getPrivateConfig({ ...BASE, GITHUB_PRIVATE_REPO: "glass-private" }),
    ).toEqual({
      token: "t",
      owner: "godfreyponce",
      repo: "glass-private",
      branch: "main",
    });
  });
});
