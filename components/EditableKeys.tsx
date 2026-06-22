"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ApiKey } from "@/lib/schema";
import { providerLabel } from "@/lib/keys";
import ProviderLogo from "@/components/ProviderLogo";
import { useLock } from "@/components/LockProvider";

/**
 * Inline editor for a project's `api_keys` (detail page only). Locked: a
 * read-only list. Unlocked: each key is a chip that expands into an edit form
 * on click, with hover-to-remove and an "Add key" affordance. Persists the
 * whole array via PATCH /api/projects/[slug] — mirroring EditableField's
 * passphrase header, optimistic state, and dev/prod (refresh vs redeploy) split.
 */

interface KeyDraft {
  provider: string;
  label: string;
  location: string;
  env_var: string;
}

const EMPTY_DRAFT: KeyDraft = { provider: "", label: "", location: "", env_var: "" };

const INPUT =
  "rounded-[4px] border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-[#bdbdbd] disabled:opacity-60";

export default function EditableKeys({
  slug,
  initialKeys,
}: {
  slug: string;
  initialKeys: ApiKey[] | undefined;
}) {
  const { locked, passphrase } = useLock();
  const router = useRouter();

  const [keys, setKeys] = useState<ApiKey[]>(initialKeys ?? []);
  // Index of the key being edited; `keys.length` means a new key; null = none.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<KeyDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync optimistic state when the server props change (router.refresh in
  // dev), but never while the user is mid-edit or a save is in flight.
  useEffect(() => {
    if (editingIndex !== null || saving) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeys(initialKeys ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKeys]);

  function startEdit(index: number) {
    const k = keys[index];
    setDraft({
      provider: k.provider,
      label: k.label ?? "",
      location: k.location,
      env_var: k.env_var ?? "",
    });
    setEditingIndex(index);
    setError(null);
  }

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setEditingIndex(keys.length);
    setError(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setError(null);
  }

  async function persist(next: ApiKey[], onOk?: () => void) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-passphrase": passphrase ?? "",
        },
        body: JSON.stringify({ api_keys: next.length > 0 ? next : null }),
      });
      const data = (await res.json()) as {
        error?: string;
        issues?: { field: string; message: string }[];
        persistence?: "local" | "github";
      };
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? `Save failed (${res.status}).`);
        setSaving(false);
        return;
      }
      setKeys(next);
      onOk?.();
      setSaving(false);
      if (data.persistence === "github") {
        window.dispatchEvent(new CustomEvent("portfolio:redeploying"));
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  async function saveDraft() {
    const provider = draft.provider.trim().toLowerCase();
    const location = draft.location.trim();
    if (!/^[a-z0-9-]+$/.test(provider)) {
      setError("Provider must be lowercase letters, numbers, or hyphens.");
      return;
    }
    if (!location) {
      setError("Location is required.");
      return;
    }
    const cleaned: ApiKey = { provider, location };
    if (draft.label.trim()) cleaned.label = draft.label.trim();
    if (draft.env_var.trim()) cleaned.env_var = draft.env_var.trim();

    const next = [...keys];
    if (editingIndex !== null && editingIndex < keys.length) {
      next[editingIndex] = cleaned;
    } else {
      next.push(cleaned);
    }
    await persist(next, () => setEditingIndex(null));
  }

  function removeKey(index: number) {
    void persist(keys.filter((_, i) => i !== index));
  }

  // -- locked: read-only list ------------------------------------------------
  if (locked) {
    return (
      <ul className="flex flex-col gap-2">
        {keys.map((k, i) => (
          <li key={`${k.provider}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
    );
  }

  // -- unlocked: editable ----------------------------------------------------
  return (
    <div className="flex flex-col gap-2">
      {keys.map((k, i) =>
        editingIndex === i ? (
          <KeyForm
            key={`edit-${i}`}
            draft={draft}
            setDraft={setDraft}
            onSave={saveDraft}
            onCancel={cancelEdit}
            saving={saving}
            error={error}
          />
        ) : (
          <div key={`${k.provider}-${i}`} className="group flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => startEdit(i)}
              title="Click to edit"
              className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-[#f7f6f3] px-2.5 py-1 text-sm text-ink hover:border-[#bdbdbd]"
            >
              <ProviderLogo provider={k.provider} box="h-[18px] w-[18px]" />
              <span>{providerLabel(k.provider)}</span>
              {k.label && <span className="text-muted">· {k.label}</span>}
            </button>
            <span className="text-xs text-muted">{k.location}</span>
            {k.env_var && (
              <code className="rounded bg-[#f1f1ef] px-1.5 py-0.5 font-mono text-[0.72rem] text-muted">
                {k.env_var}
              </code>
            )}
            <button
              type="button"
              onClick={() => removeKey(i)}
              disabled={saving}
              aria-label="Remove key"
              className="rounded-[4px] px-1.5 text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 disabled:opacity-30"
            >
              &times;
            </button>
          </div>
        ),
      )}

      {editingIndex === keys.length && (
        <KeyForm
          draft={draft}
          setDraft={setDraft}
          onSave={saveDraft}
          onCancel={cancelEdit}
          saving={saving}
          error={error}
        />
      )}

      {editingIndex === null && (
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex w-fit items-center gap-1.5 rounded-[6px] border border-dashed border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#f7f6f3]"
        >
          <span aria-hidden>+</span> Add key
        </button>
      )}
    </div>
  );
}

function KeyForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: KeyDraft;
  setDraft: React.Dispatch<React.SetStateAction<KeyDraft>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-line bg-[#f7f6f3] p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={draft.provider}
          onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
          onKeyDown={onKeyDown}
          placeholder="anthropic"
          aria-label="Provider"
          disabled={saving}
          className={`${INPUT} font-mono`}
        />
        <input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          onKeyDown={onKeyDown}
          placeholder="label (optional)"
          aria-label="Label"
          disabled={saving}
          className={INPUT}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={draft.location}
          onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          onKeyDown={onKeyDown}
          placeholder="where it's stored"
          aria-label="Location"
          disabled={saving}
          className={INPUT}
        />
        <input
          value={draft.env_var}
          onChange={(e) => setDraft((d) => ({ ...d, env_var: e.target.value }))}
          onKeyDown={onKeyDown}
          placeholder="ENV_VAR (optional)"
          aria-label="Env var"
          disabled={saving}
          className={`${INPUT} font-mono`}
        />
      </div>
      {error && <p className="text-xs text-[#9f2f2d]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-[6px] bg-[#111111] px-3 py-1 text-xs font-medium text-white hover:bg-[#333333] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[6px] border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
