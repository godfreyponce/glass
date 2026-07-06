"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(false);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      // Full navigation so proxy re-evaluates with the new session cookie.
      window.location.href = "/";
    } else {
      setError(true);
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8">
        <div className="font-serif text-2xl italic text-ink">Glass</div>
        <p className="mt-1 text-sm text-muted">Enter the password to continue.</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`rounded-md border bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-ink ${
              error ? "border-red-400" : "border-line"
            }`}
          />
          <button
            type="submit"
            disabled={busy || password === ""}
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {busy ? "…" : "Enter"}
          </button>
        </form>
        {error && (
          <div className="mt-3 text-sm text-red-600">Incorrect password.</div>
        )}
      </div>
    </main>
  );
}
