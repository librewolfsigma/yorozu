// Extension repository types — the upstream-manifest contract.
//
// Extensions are DATA, never code. A provider extension is a declarative
// "recipe" (URL templates, regex field extractors, JSON dot-paths) that the
// recipe engine (./engine) executes to produce a real LiveAdapter. Nothing
// here is ever evaluated as JavaScript: recipes can only fetch public URLs,
// run anchored regexes and string-replace into templates. That is what makes
// auto-syncing third-party repositories safe.

export const MANIFEST_VERSION = 1;

/** Supported categories mirror the platform taxonomy. */
const CATEGORIES = new Set([
  "ANIME", "MANGA", "MANHWA", "ILLUSTRATION", "AV", "GAME", "DATABASE", "SCRIPT", "MISC",
]);

export interface FieldRegex {
  /** First capture group becomes the value. Run against the block (list) or page (details). */
  regex: string;
  /** Decode HTML entities + trim (default true). */
  decode?: boolean;
  /** Treat capture as an integer. */
  int?: boolean;
  /** Optional capture → value rewrite (first match of `search` replaced). */
  replace?: [string, string];
}

/** JSON-recipe field: dot-path into the current item (e.g. "title.pretty"). */
export type JsonField = string;

export interface RecipeCommon {
  /** URL template: {q} (URI-encoded), {page}. */
  url: string;
  /** plain fetch | resilient (falls back to the system curl on 403/503). */
  transport?: "plain" | "resilient";
}

export interface HtmlListRecipe extends RecipeCommon {
  type: "html";
  /** Global regex; named groups id/title/cover (or capture order 1,2,3) + optional body group for field regexes. */
  blockRegex: string;
  /** Extra per-item fields extracted from the `body` capture or the whole block. */
  fields?: Record<string, FieldRegex>;
  /** Post-extraction templates, e.g. externalUrl: "https://site/g/{id}/". */
  templates?: Record<string, string>;
  /** Client-side filters (e.g. rating === "e"). All must pass. */
  filters?: { field: string; equals?: string; notEquals?: string; contains?: string }[];
  /** Keep at most N items per page (default 24). */
  limit?: number;
}

export interface JsonListRecipe extends RecipeCommon {
  type: "json";
  /** Dot-path to the array: e.g. "result" or "data.posts". */
  listPath: string;
  /** Dot-paths for fields; missing → omitted. */
  fields: Record<string, JsonField>;
  templates?: Record<string, string>;
  filters?: { field: string; equals?: string; notEquals?: string; contains?: string }[];
  limit?: number;
}

export type ListRecipe = HtmlListRecipe | JsonListRecipe;

export interface DetailsRecipe {
  url: string; // {id}
  type: "html" | "json";
  transport?: "plain" | "resilient";
  /** html: global regex over the page producing id/title/cover/body. */
  blockRegex?: string;
  /** json: dot-path to the object ("" = root). */
  listPath?: string;
  fields?: Record<string, FieldRegex | JsonField>;
  templates?: Record<string, string>;
}

export interface UnitsRecipe {
  kind: "gallery" | "chapters";
  /** Gallery: build page URLs by string-replacing in a details field. */
  pagesFrom?: {
    from: string; // details field, e.g. "cover"
    search: string; // e.g. "cover.jpg"
    replace: string; // e.g. "{n}.webp" — {n} = 1-based page number
  };
  /** Details field holding the page/chapter count (int). */
  countFrom?: string;
  /** Safety cap on inline pages per work (default 400). */
  maxPages?: number;
}

export interface ExtProviderDef {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
  capabilities: string[];
  configSchema: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    help?: string;
  }[];
  /** Media hosts this provider serves images/streams from — added to the
   *  proxy allowlist ONLY while the extension is installed & synced. */
  mediaHosts?: string[];
  /** Host suffixes (rotating CDN shards), e.g. ".hentaifox.com". */
  mediaHostSuffixes?: string[];
  /** Allow the /api/img curl fallback transport for this provider's media. */
  resilientMedia?: boolean;
  recipe: {
    search?: ListRecipe;
    popular?: ListRecipe;
    details?: DetailsRecipe;
    units?: UnitsRecipe;
  };
}

export interface ExtManifest {
  manifestVersion: number;
  repoId: string;
  repoUrl?: string;
  updated?: string;
  providers: ExtProviderDef[];
}

// ─────────────────────────── validation ───────────────────────────
// Manual, dependency-free, strict. A manifest that fails validation is
// rejected WHOLE — no partial adoption of unknown shapes.

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isFieldRegex(v: unknown): v is FieldRegex {
  return !!v && typeof v === "object" && isStr((v as FieldRegex).regex);
}
function recipeCommonValid(r: unknown): r is RecipeCommon {
  const o = r as RecipeCommon;
  return !!o && isStr(o.url) && (o.transport === undefined || o.transport === "plain" || o.transport === "resilient");
}
function listRecipeValid(r: unknown): r is ListRecipe {
  const o = r as ListRecipe;
  if (!o || !recipeCommonValid(o)) return false;
  if (o.type === "html") return isStr((o as HtmlListRecipe).blockRegex);
  if (o.type === "json") return isStr((o as JsonListRecipe).listPath) && !!(o as JsonListRecipe).fields;
  return false;
}

export function validateManifest(raw: unknown): { ok: true; manifest: ExtManifest } | { ok: false; error: string } {
  const m = raw as ExtManifest;
  if (!m || typeof m !== "object") return { ok: false, error: "manifest is not an object" };
  if (m.manifestVersion !== MANIFEST_VERSION) {
    return { ok: false, error: `unsupported manifestVersion ${m.manifestVersion} (want ${MANIFEST_VERSION})` };
  }
  if (!isStr(m.repoId)) return { ok: false, error: "repoId missing" };
  if (!Array.isArray(m.providers)) return { ok: false, error: "providers must be an array" };
  const seen = new Set<string>();
  for (const p of m.providers) {
    if (!p || !isStr(p.id) || !/^[a-z0-9-]{2,40}$/.test(p.id)) return { ok: false, error: `invalid provider id: ${String(p?.id)}` };
    if (seen.has(p.id)) return { ok: false, error: `duplicate provider id: ${p.id}` };
    seen.add(p.id);
    if (!isStr(p.name) || !isStr(p.category) || !CATEGORIES.has(p.category)) return { ok: false, error: `${p.id}: bad name/category` };
    if (!isStr(p.version) || !isStr(p.description) || !isStr(p.homepage)) return { ok: false, error: `${p.id}: missing version/description/homepage` };
    if (!Array.isArray(p.capabilities)) return { ok: false, error: `${p.id}: capabilities must be an array` };
    if (p.configSchema !== undefined && !Array.isArray(p.configSchema)) return { ok: false, error: `${p.id}: configSchema must be an array` };
    if (!p.recipe || typeof p.recipe !== "object") return { ok: false, error: `${p.id}: recipe missing` };
    const r = p.recipe;
    if (r.search && !listRecipeValid(r.search)) return { ok: false, error: `${p.id}: bad search recipe` };
    if (r.popular && !listRecipeValid(r.popular)) return { ok: false, error: `${p.id}: bad popular recipe` };
    if (r.details) {
      const d = r.details as unknown as RecipeCommon;
      if (!isStr(d.url)) return { ok: false, error: `${p.id}: details recipe needs a url template` };
    }
    if (r.units) {
      const u = r.units;
      if (u.kind !== "gallery" && u.kind !== "chapters") return { ok: false, error: `${p.id}: bad units kind` };
      if (u.pagesFrom && !(isStr(u.pagesFrom.from) && isStr(u.pagesFrom.search) && isStr(u.pagesFrom.replace))) {
        return { ok: false, error: `${p.id}: bad units.pagesFrom` };
      }
    }
    if (r.search === undefined && r.popular === undefined) {
      return { ok: false, error: `${p.id}: recipe must implement search or popular` };
    }
    if (p.mediaHosts !== undefined && !Array.isArray(p.mediaHosts)) return { ok: false, error: `${p.id}: mediaHosts must be an array` };
    if (p.mediaHostSuffixes !== undefined && !Array.isArray(p.mediaHostSuffixes)) return { ok: false, error: `${p.id}: mediaHostSuffixes must be an array` };
  }
  return { ok: true, manifest: m };
}
