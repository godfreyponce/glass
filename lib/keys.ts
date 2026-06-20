import type { ProjectFrontmatter } from "@/lib/schema";

/**
 * A distinct API key. Identity is `label` when present, else `location` — so
 * two projects pointing at the same key collapse into one entry, while two
 * different keys from the same provider stay separate.
 */
export interface KeyEntry {
  id: string;
  label?: string;
  location: string;
  env_var?: string;
  projects: string[];
}

/** A provider and its distinct keys, sorted by provider id. */
export interface ProviderKeys {
  provider: string;
  keys: KeyEntry[];
}

/** Pure: group every project's `api_keys` by provider, then by key identity. */
export function aggregateKeys(projects: ProjectFrontmatter[]): ProviderKeys[] {
  const providers = new Map<string, Map<string, KeyEntry>>();

  for (const project of projects) {
    for (const key of project.api_keys ?? []) {
      let byId = providers.get(key.provider);
      if (!byId) {
        byId = new Map();
        providers.set(key.provider, byId);
      }
      const id = key.label ?? key.location;
      let entry = byId.get(id);
      if (!entry) {
        entry = {
          id,
          label: key.label,
          location: key.location,
          env_var: key.env_var,
          projects: [],
        };
        byId.set(id, entry);
      }
      if (!entry.projects.includes(project.slug)) {
        entry.projects.push(project.slug);
      }
    }
  }

  return [...providers.entries()]
    .map(([provider, byId]) => ({ provider, keys: [...byId.values()] }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Total number of distinct keys across all providers. */
export function totalKeyCount(groups: ProviderKeys[]): number {
  return groups.reduce((sum, g) => sum + g.keys.length, 0);
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

/** Human display name for a provider id; falls back to capitalizing the id. */
export function providerLabel(provider: string): string {
  return (
    PROVIDER_LABELS[provider] ??
    provider.charAt(0).toUpperCase() + provider.slice(1)
  );
}
