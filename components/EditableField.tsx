"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useLock } from "@/components/LockProvider";

type FieldType = "text" | "url" | "textarea" | "date" | "select" | "array";

type Value = string | string[] | undefined;

interface EditableFieldProps {
  /** Project slug — target of the PATCH. */
  slug: string;
  /** Frontmatter key being edited. */
  field: string;
  type: FieldType;
  initialValue: Value;
  /** When true, clearing the input sends `null` to delete the field. */
  optional?: boolean;
  /** For type="select". */
  options?: readonly string[];
  /** Placeholder when value is empty in edit mode. */
  placeholder?: string;
  /** Shown in view mode when value is empty and editor is unlocked. */
  emptyLabel?: string;
  /** Custom view-mode renderer. Receives the (optimistic) current value. */
  display?: (value: Value) => React.ReactNode;
  /** Wrapper className for the displayed value. */
  className?: string;
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function valuesEqual(a: Value, b: Value): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return arraysEqual(a as string[] | undefined, b as string[] | undefined);
  }
  return a === b;
}

function valueToInput(v: Value): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}

function inputToValue(raw: string, type: FieldType): Value {
  const trimmed = raw.trim();
  if (type === "array") {
    const parts = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function EditableField({
  slug,
  field,
  type,
  initialValue,
  optional = false,
  options,
  placeholder,
  emptyLabel,
  display,
  className,
}: EditableFieldProps) {
  const { locked, passphrase } = useLock();
  const router = useRouter();

  const [value, setValue] = useState<Value>(initialValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(valueToInput(initialValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  // Sync local optimistic state when the parent re-renders with new props
  // (e.g. router.refresh() in dev replaces the server-rendered value).
  // This is React's documented "derived state from props" pattern — the
  // setState-in-effect rule's recommended alternative (lazy initializer)
  // doesn't apply because we need to react to *changes* in initialValue.
  useEffect(() => {
    if (!editing && !valuesEqual(initialValue, value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initialValue);
      setDraft(valueToInput(initialValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit(rawDraft: string) {
    const next = inputToValue(rawDraft, type);
    if (valuesEqual(next, value)) {
      setEditing(false);
      return;
    }
    if (!optional && next === undefined) {
      setError("Field is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const patchValue =
      next === undefined ? (optional ? null : undefined) : next;
    const payload: Record<string, unknown> = { [field]: patchValue };

    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-passphrase": passphrase ?? "",
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        issues?: { field: string; message: string }[];
        persistence?: "local" | "github";
      };

      if (!res.ok) {
        const detail =
          data.issues?.find((i) => i.field === field)?.message ?? data.error;
        setError(detail ?? `Save failed (${res.status}).`);
        setSaving(false);
        return;
      }

      setValue(next);
      setEditing(false);
      setSaving(false);

      if (data.persistence === "github") {
        window.dispatchEvent(new CustomEvent("portfolio:redeploying"));
      } else {
        // Dev: re-read server state so other fields stay coherent.
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(valueToInput(value));
    setEditing(false);
    setError(null);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      void commit(draft);
    }
  }

  // -- view mode ------------------------------------------------------------
  if (!editing) {
    const isEmpty =
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "string" && value.length === 0);

    const view = display ? (
      display(value)
    ) : isEmpty ? (
      <span className="text-muted italic">{emptyLabel ?? "—"}</span>
    ) : Array.isArray(value) ? (
      value.join(", ")
    ) : (
      value
    );

    if (locked) {
      return <span className={className}>{view}</span>;
    }

    return (
      <span
        className={`${className ?? ""} cursor-text rounded-sm decoration-dashed decoration-line decoration-1 underline-offset-4 hover:bg-[#f7f6f3] hover:underline`}
        title="Double-click to edit"
        onDoubleClick={() => {
          setDraft(valueToInput(value));
          setEditing(true);
          setError(null);
        }}
      >
        {view}
      </span>
    );
  }

  // -- edit mode ------------------------------------------------------------
  const baseInputClass =
    "rounded-[4px] border border-line bg-surface px-2 py-1 text-inherit outline-none focus:border-[#bdbdbd]";

  let input: React.ReactNode;
  if (type === "textarea") {
    input = (
      <textarea
        ref={(el) => {
          inputRef.current = el;
        }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={saving}
        rows={3}
        className={`${baseInputClass} w-full font-sans`}
      />
    );
  } else if (type === "select") {
    input = (
      <select
        ref={(el) => {
          inputRef.current = el;
        }}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          void commit(e.target.value);
        }}
        onKeyDown={handleKey}
        disabled={saving}
        className={`${baseInputClass} font-sans`}
      >
        {options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  } else {
    const inputType =
      type === "date" ? "date" : type === "url" ? "url" : "text";
    input = (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={saving}
        className={`${baseInputClass} font-sans`}
      />
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      {input}
      {error && (
        <span className="font-sans text-xs text-[#9f2f2d]">{error}</span>
      )}
    </span>
  );
}
