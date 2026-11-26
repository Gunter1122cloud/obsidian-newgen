import { describe, expect, it, vi } from "vitest";
import { ModsService } from "@backend/domains/mods/mods-service";

const credential = "test-only-key";
const asa = { id: 42, gameId: 83374, slug: "example", name: "Example", categories: [] };

function fixture(fetchImpl: typeof fetch): ModsService {
  return new ModsService({ buildDefaultUrl: "", fetchImpl, directApiKey: async () => credential });
}

describe("local CurseForge API", () => {
  it("searches only ASA at the official endpoint without forwarding credentials to redirects", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [asa, { ...asa, id: 43, gameId: 1 }], pagination: { totalCount: 2 } }));
    const page = await fixture(fetchImpl).search("example");
    expect(page.items.map((item) => item.id)).toEqual(["42"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.curseforge.com/v1/mods/search?gameId=83374&searchFilter=example",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": credential }),
        redirect: "error",
      }),
    );
  });

  it("fetches mod detail and description", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: asa }))
      .mockResolvedValueOnce(Response.json({ data: "Example &amp; detail" }));
    expect(await fixture(fetchImpl).getMod("42")).toMatchObject({ id: "42", description: "Example & detail" });
  });

  it("uses numeric batch IDs and keeps only ASA projects", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [asa] }));
    expect((await fixture(fetchImpl).getMods(["42", "43"])).map((item) => item.id)).toEqual(["42"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.curseforge.com/v1/mods",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ modIds: [42, 43] }) }),
    );
  });

  it("loads live category IDs and rejects unauthorized responses without printing the secret", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [{ id: 7, name: "Maps", slug: "maps", gameId: 83374 }] }))
      .mockResolvedValueOnce(new Response(credential, { status: 401 }));
    const service = fixture(fetchImpl);
    expect(await service.listCategories()).toMatchObject([{ id: 7, name: "Maps" }]);
    await expect(service.search("")).rejects.toThrow("CurseForge API returned HTTP 401.");
  });
});
