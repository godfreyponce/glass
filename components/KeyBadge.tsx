import type { ApiKey } from "@/lib/schema";
import { providerLabel } from "@/lib/keys";
import ProviderLogo from "@/components/ProviderLogo";

/**
 * Variant A — the compact "this project has active API keys" cluster shown
 * beside the status badge on a project card: a key glyph + overlapping
 * provider logos. Renders nothing when there are no keys.
 */
export default function KeyBadge({ apiKeys }: { apiKeys: ApiKey[] }) {
  if (apiKeys.length === 0) return null;

  const summary = `${apiKeys.length} active API key${apiKeys.length > 1 ? "s" : ""}`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[15px] w-[15px] text-muted"
      >
        <title>{summary}</title>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m21 2-9.6 9.6" />
        <path d="m15.5 7.5 3 3L22 7l-3-3" />
      </svg>
      <span className="flex items-center gap-1">
        {apiKeys.map((key, i) => (
          <span
            key={`${key.provider}-${i}`}
            title={providerLabel(key.provider)}
            className="inline-flex"
          >
            <ProviderLogo provider={key.provider} box="h-[24px] w-[24px]" />
          </span>
        ))}
      </span>
    </span>
  );
}
