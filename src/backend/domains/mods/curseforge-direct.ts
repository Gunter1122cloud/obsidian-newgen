import { decodeHtmlEntities } from "@shared/mods/decode-html-entities";
import { normalizeModScreenshotUrls } from "@shared/mods/mod-screenshot-urls";
import type { ModCategory, ModMetadata, ModSearchPage } from "@shared/types";

const ASA_GAME_ID = 83374;
const API = "https://api.curseforge.com";
type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error("CurseForge returned an invalid catalog payload.");
  return value.map(row);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => text(row(entry).name)).filter(Boolean) : [];
}

function isAsa(mod: Row): boolean {
  return Number(mod.gameId) === ASA_GAME_ID && /^[1-9]\d*$/.test(String(mod.id));
}

function toMetadata(mod: Row, description: string | null = null): ModMetadata {
  const id = String(mod.id);
  const slug = text(mod.slug, id);
  const logo = row(mod.logo);
  const screenshots = Array.isArray(mod.screenshots)
    ? mod.screenshots.map((entry) => text(row(entry).url, text(row(entry).thumbnailUrl)))
    : [];
  return {
    id,
    slug,
    name: text(mod.name, `Mod ${id}`),
    summary: text(mod.summary),
    description,
    thumbnailUrl: text(logo.thumbnailUrl, text(logo.url)) || null,
    screenshots: normalizeModScreenshotUrls(screenshots),
    authors: names(mod.authors),
    categories: names(mod.categories),
    downloadCount: number(mod.downloadCount),
    dateModified: text(mod.dateModified, text(mod.dateReleased, new Date(0).toISOString())),
    curseforgeUrl: text(row(mod.links).websiteUrl, `https://www.curseforge.com/ark-survival-ascended/mods/${slug}`),
  };
}

function category(value: Row): ModCategory {
  return {
    id: number(value.id),
    name: text(value.name),
    slug: text(value.slug),
    isClass: value.isClass === true,
    classId: number(value.classId) || null,
    parentCategoryId: number(value.parentCategoryId) || null,
    displayIndex: typeof value.displayIndex === "number" ? value.displayIndex : null,
  };
}

async function request(fetchImpl: typeof fetch, key: string, path: string, body?: string): Promise<Row> {
  let response: Response;
  try {
    response = await fetchImpl(API + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": key },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Could not reach the official CurseForge API.");
  }
  if (!response.ok) throw new Error(`CurseForge API returned HTTP ${response.status}.`);
  try {
    const payload = row(await response.json());
    if (!Object.hasOwn(payload, "data")) throw new Error("Missing data");
    return payload;
  } catch {
    throw new Error("CurseForge returned an invalid JSON payload.");
  }
}

async function description(fetchImpl: typeof fetch, key: string, id: string): Promise<string | null> {
  try {
    const payload = await request(fetchImpl, key, `/v1/mods/${id}/description?stripped=true`);
    return decodeHtmlEntities(text(payload.data).trim()).slice(0, 12_000) || null;
  } catch {
    return null;
  }
}

async function batch(fetchImpl: typeof fetch, key: string, init?: RequestInit): Promise<{ items: ModMetadata[] }> {
  const ids = row(JSON.parse(typeof init?.body === "string" ? init.body : "{}")).modIds;
  if (!Array.isArray(ids) || ids.some((id) => !/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)))) {
    throw new Error("Invalid CurseForge project IDs.");
  }
  const items: ModMetadata[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const modIds = ids.slice(index, index + 50).map(Number);
    const payload = await request(fetchImpl, key, "/v1/mods", JSON.stringify({ modIds }));
    for (const mod of rows(payload.data).filter(isAsa)) {
      const detail = names(mod.categories).some((name) => /\bmaps?\b/i.test(name));
      items.push(toMetadata(mod, detail ? await description(fetchImpl, key, String(mod.id)) : null));
    }
  }
  return { items };
}

async function search(fetchImpl: typeof fetch, key: string, url: URL): Promise<ModSearchPage> {
  const params = new URLSearchParams({ gameId: String(ASA_GAME_ID) });
  for (const name of ["searchFilter", "slug", "index", "pageSize", "classId", "categoryId", "sortField", "sortOrder"]) {
    const value = url.searchParams.get(name);
    if (value !== null) params.set(name, value);
  }
  const payload = await request(fetchImpl, key, `/v1/mods/search?${params}`);
  const pagination = row(payload.pagination);
  return {
    items: rows(payload.data).filter(isAsa).map((mod) => toMetadata(mod)),
    pagination: {
      index: number(pagination.index),
      pageSize: number(pagination.pageSize),
      resultCount: number(pagination.resultCount),
      totalCount: number(pagination.totalCount),
    },
  };
}

/** Adapt the existing private proxy contract to the official API without sharing the user's key. */
export async function fetchDirectCurseForge(
  fetchImpl: typeof fetch,
  key: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = new URL(path, API);
  if (url.origin !== API) throw new Error("Unsupported CurseForge metadata route.");
  if (url.pathname === "/v1/mods/search") return search(fetchImpl, key, url);
  if (url.pathname === "/v1/mods" && init?.method === "POST") return batch(fetchImpl, key, init);
  if (url.pathname === "/v1/categories") {
    const payload = await request(fetchImpl, key, `/v1/categories?gameId=${ASA_GAME_ID}`);
    return {
      categories: rows(payload.data)
        .filter((entry) => number(entry.gameId) === 0 || number(entry.gameId) === ASA_GAME_ID)
        .map(category)
        .filter((entry) => entry.id > 0 && entry.name && entry.slug),
    };
  }
  const id = /^\/v1\/mods\/([1-9]\d*)$/.exec(url.pathname)?.[1];
  if (id !== undefined) {
    const payload = await request(fetchImpl, key, `/v1/mods/${id}`);
    const mod = row(payload.data);
    if (!isAsa(mod) || String(mod.id) !== id) throw new Error("CurseForge project is not a matching ASA mod.");
    return toMetadata(mod, await description(fetchImpl, key, id));
  }
  throw new Error("Unsupported CurseForge metadata route.");
}
