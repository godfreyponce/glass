import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

import { isAvailable } from "@/lib/claude-code";

const execFileP = promisify(execFile);

/**
 * POST /api/pick-dir — DEV-ONLY, macOS only.
 *
 * Opens the native Finder folder chooser via `osascript` and returns the
 * absolute POSIX path of the chosen directory. A browser file picker can't
 * hand the server a real filesystem path, but the dev server is Node on the
 * user's Mac, so we ask the OS directly. Cancelling the dialog returns
 * `{ canceled: true }`. Production responds 503 (no local GUI / auth).
 */
export async function POST(): Promise<Response> {
  if (!isAvailable()) {
    return NextResponse.json(
      {
        error:
          "Choosing a project folder is a dev-only feature — it opens a native macOS dialog on your machine.",
      },
      { status: 503 },
    );
  }

  if (process.platform !== "darwin") {
    return NextResponse.json(
      {
        error:
          "The folder picker is macOS-only. Paste a path manually, or run this on a Mac.",
      },
      { status: 501 },
    );
  }

  try {
    const { stdout } = await execFileP("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Pick a project to add")',
    ]);
    const dir = stdout.trim();
    if (!dir) return NextResponse.json({ canceled: true });
    return NextResponse.json({ path: dir });
  } catch (err) {
    // osascript exits non-zero with "User canceled. (-128)" when dismissed.
    const message = err instanceof Error ? err.message : String(err);
    if (/-128|canceled/i.test(message)) {
      return NextResponse.json({ canceled: true });
    }
    return NextResponse.json(
      { error: `Could not open the folder picker: ${message}` },
      { status: 500 },
    );
  }
}
