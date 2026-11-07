// Extension recipe engine — turns a declarative ExtProviderDef into a real
// LiveAdapter. Recipes are pure data: URL templates + regex extractors +
// dot-paths. Nothing is evaluated, nothing executes — the engine is the only
// interpreter, and every operation it performs is a fetch, a regex, a dot-path
// lookup or a string replace. See ./types for the manifest contract.

import {
  liveFetch, liveJson, liveText, liveTextResilient, htmlDecode, match1,
  type LiveFetchOpts,
} from "../live/http";
import type { LiveAdapter, LiveSearchItem, LiveUnits, SearchOpts } from "../live/types";
import type {
  DetailsRecipe, ExtProviderDef, FieldRegex, JsonListRecipe, ListRecipe, UnitsRecipe,
} from "./types";

const DEFAULT_LIMIT = 24;
const DEFAULT_MAX_PAGES = 400;

// ─── template + path helpers (the engine's entire "scripting" surface) ───

function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === "q") return encodeURIComponent(String(vars.q ?? ""));
    const v = vars[k];
    return v === undefined ? "" : encodeURIComponent(String(v));
  });
}

/** Safe dot-path lookup on a JSON value — never evaluates expressions. */
function dotPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function applyTemplates(templates: Record<string, string> | undefined, item: Record<string, unknown>): void {
  for (const [k, tpl] of Object.entries(templates ?? {})) {
    if (item[k] === undefined || item[k] === "") {
      item[k] = fillTemplate(tpl, item as Record<string, string>);
    }
  }
}

function passesFilters(
  filters: { field: string; equals?: string; notEquals?: string; contains?: string }[] | undefined,
  item: Record<string, unknown>,
): boolean {
  for (const f of filters ?? []) {
    const v = String(item[f.field] ?? "");
    if (f.equals !== undefined && v !== f.equals) return false;
    if (f.notEquals !== undefined && v === f.notEquals) return false;
    if (f.contains !== undefined && !v.includes(f.contains)) return false;
  }
  return true;
}

// ─── field extraction (shared by list + details recipes) ───

function isFieldRegex(v: unknown): v is FieldRegex {
  return !!v && typeof v === "object" && typeof (v as FieldRegex).regex === "string";
}

function coerce(v: string, fr: FieldRegex): string | number {
  let val: string | number;
  if (fr.int) val = parseInt(v, 10) || 0;
  else if (fr.decode !== false) val = htmlDecode(v).trim();
  else val = v;
  if (fr.replace) val = String(val).replace(fr.replace[0], fr.replace[1]);
  return val;
}

/** Run regex-field definitions against a scope string. */
function extractRegexFields(
  scope: string,
  fields: Record<string, FieldRegex | string> | undefined,
  into: Record<string, unknown>,
): void {
  for (const [key, frRaw] of Object.entries(fields ?? {})) {
    if (typeof frRaw === "string") {
      const v = match1(scope, new RegExp(frRaw));
      if (v !== null) into[key] = v;
      continue;
    }
    const v = match1(scope, new RegExp(frRaw.regex));
    if (v !== null) into[key] = coerce(v, frRaw);
  }
}

type ExtractedItem = Record<string, unknown> & { id: string };

function extractHtmlItems(html: string, recipe: Extract<ListRecipe, { type: "html" }>): ExtractedItem[] {
  const out: ExtractedItem[] = [];
  for (const m of html.matchAll(new RegExp(recipe.blockRegex, "g"))) {
    const g = m.groups ?? {};
    const item: Record<string, unknown> = {
      ...g,
      id: g.id ?? m[1] ?? "",
      title: g.title ?? m[2],
      cover: g.cover ?? m[3],
    };
    if (!item.id) continue;
    const scope = (g.body as string | undefined) ?? m[0];
    extractRegexFields(scope, recipe.fields as Record<string, FieldRegex | string> | undefined, item);
    applyTemplates(recipe.templates, item);
    if (passesFilters(recipe.filters, item)) out.push(item as ExtractedItem);
  }
  return out;
}

function extractJsonItems(payload: unknown, recipe: JsonListRecipe): ExtractedItem[] {
  const list = dotPath(payload, recipe.listPath);
  if (!Array.isArray(list)) return [];
  const out: ExtractedItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item: Record<string, unknown> = {};
    for (const [key, path] of Object.entries(recipe.fields)) {
      const v = dotPath(raw, path);
      if (v !== undefined && v !== null) item[key] = v;
    }
    item.id = item.id ?? dotPath(raw, "id");
    if (!item.id) continue;
    item.id = String(item.id);
    applyTemplates(recipe.templates, item);
    if (passesFilters(recipe.filters, item)) out.push(item as ExtractedItem);
  }
  return out;
}

async function fetchRecipeText(url: string, transport: "plain" | "resilient" | undefined): Promise<string> {
  const opts: LiveFetchOpts = { cacheTtlMs: 3 * 60 * 1000 };
  return transport === "resilient" ? liveTextResilient(url, opts) : liveText(url, opts);
}

async function runListRecipe(recipe: ListRecipe, vars: { q?: string; page: number }): Promise<LiveSearchItem[]> {
  const url = fillTemplate(recipe.url, { q: vars.q ?? "", page: vars.page });
  const limit = recipe.limit ?? DEFAULT_LIMIT;

  const extracted =
    recipe.type === "json"
      ? extractJsonItems(await liveJson<unknown>(url, { cacheTtlMs: 3 * 60 * 1000 }), recipe)
      : extractHtmlItems(await fetchRecipeText(url, recipe.transport), recipe);

  return extracted.slice(0, limit).map((it) => ({
    externalId: String(it.id),
    title: htmlDecode(String(it.title ?? `Item ${it.id}`)).trim() || `Item ${it.id}`,
    coverUrl: typeof it.cover === "string" && it.cover ? it.cover : null,
    externalUrl: typeof it.externalUrl === "string" ? it.externalUrl : undefined,
    category: "",
    extra: { fromRecipe: true },
  }));
}

async function runDetailsRecipe(
  recipe: DetailsRecipe,
  externalId: string,
): Promise<ExtractedItem | null> {
  const url = fillTemplate(recipe.url, { id: externalId });
  const fields: Record<string, unknown> = { id: externalId };

  if (recipe.type === "json") {
    const payload = await liveJson<unknown>(url, { cacheTtlMs: 60 * 1000 });
    const obj = dotPath(payload, recipe.listPath ?? "");
    if (!obj || typeof obj !== "object") return null;
    Object.assign(fields, obj as Record<string, unknown>);
    for (const [key, path] of Object.entries(recipe.fields ?? {})) {
      if (typeof path !== "string") continue;
      const v = dotPath(payload, path);
      if (v !== undefined && v !== null) fields[key] = v;
    }
  } else {
    const html = await fetchRecipeText(url, recipe.transport);
    if (recipe.blockRegex) {
      const m = new RegExp(recipe.blockRegex).exec(html);
      if (!m) return null;
      const g = m.groups ?? {};
      Object.assign(fields, g);
      if (g.id) fields.id = g.id;
      if (g.title && !fields.title) fields.title = g.title;
      if (g.cover && !fields.cover) fields.cover = g.cover;
      const scope = (g.body as string | undefined) ?? m[0];
      extractRegexFields(scope, recipe.fields, fields);
    } else {
      extractRegexFields(html, recipe.fields, fields);
    }
  }

  applyTemplates(recipe.templates, fields);
  if (!fields.id) fields.id = externalId;
  return fields as ExtractedItem;
}

// ─── adapter factory ───

/**
 * Build a real LiveAdapter from an extension recipe. Capabilities are exactly
 * what the recipe implements — search needs search, rails need popular,
 * reading needs details+units. No capability is ever claimed without code
 * behind it.
 */
export function adapterFromRecipe(def: ExtProviderDef): LiveAdapter {
  const { recipe } = def;

  const toItem = (it: LiveSearchItem): LiveSearchItem => ({ ...it, category: def.category });

  const adapter: LiveAdapter = {
    id: def.id,
    integration: `extension recipe (data-driven, manifest v${def.version})`,

    async ping(): Promise<void> {
      // A real request against the cheapest declared listing.
      const probe = recipe.search ?? recipe.popular;
      if (!probe) throw new Error(`${def.name} declares no listing recipe`);
      const url = fillTemplate(probe.url, { q: "", page: 1 });
      const res = await liveFetch(url, { cacheTtlMs: 60 * 1000 });
      if (!res.ok) throw new Error(`${def.name} upstream ${res.status}`);
    },

    async search(q: string, opts?: SearchOpts): Promise<LiveSearchItem[]> {
      if (!recipe.search) return []; // honest: no search recipe → no results
      const items = await runListRecipe(recipe.search, { q, page: opts?.page ?? 1 });
      return items.map(toItem);
    },

    async popular(opts?: { page?: number }): Promise<LiveSearchItem[]> {
      if (!recipe.popular) throw new Error(`${def.name} exposes no popular listing`);
      const items = await runListRecipe(recipe.popular, { page: opts?.page ?? 1 });
      return items.map(toItem);
    },
  };

  if (recipe.details) {
    adapter.details = async (externalId: string): Promise<LiveSearchItem | null> => {
      const f = await runDetailsRecipe(recipe.details!, externalId);
      if (!f) return null;
      let home = def.homepage;
      try { home = `https://${new URL(def.homepage).host}/`; } catch { /* keep homepage */ }
      return {
        externalId: String(f.id),
        title: htmlDecode(String(f.title ?? `Item ${f.id}`)).trim() || `Item ${f.id}`,
        coverUrl: typeof f.cover === "string" && f.cover ? f.cover : null,
        externalUrl: typeof f.externalUrl === "string" ? f.externalUrl : home,
        category: def.category,
        extra: { fromRecipe: true, ...pickScalars(f, ["pages", "loadId", "count"]) },
      };
    };
  }

  if (recipe.details && recipe.units) {
    adapter.units = async (externalId: string): Promise<LiveUnits | null> => {
      const f = await runDetailsRecipe(recipe.details!, externalId);
      if (!f) return null;
      return buildUnits(recipe.units!, f);
    };
  }

  return adapter;
}

function pickScalars(f: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = f[k];
    if (typeof v === "string" || typeof v === "number") out[k] = v;
  }
  return out;
}

/** Build gallery/chapter units from a details field-set via the units recipe. */
export function buildUnits(units: UnitsRecipe, fields: Record<string, unknown>): LiveUnits | null {
  const maxPages = units.maxPages ?? DEFAULT_MAX_PAGES;

  if (units.kind === "gallery" && units.pagesFrom) {
    const src = fields[units.pagesFrom.from];
    if (typeof src !== "string" || !src) return null;
    const countRaw = units.countFrom ? fields[units.countFrom] : undefined;
    const count =
      Math.min(
        typeof countRaw === "number" ? countRaw : parseInt(String(countRaw ?? "0"), 10) || 0,
        maxPages,
      );
    if (count <= 0) return null;
    const pages: string[] = [];
    for (let n = 1; n <= count; n++) {
      pages.push(src.replace(units.pagesFrom.search, units.pagesFrom.replace.replace(/\{n\}/g, String(n))));
    }
    return { chapters: [{ number: 1, title: null, pages, pageKind: "image" }] };
  }

  return null;
}
