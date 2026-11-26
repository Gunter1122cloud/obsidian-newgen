import { describe, expect, it } from "vitest";
import { newGenLabel } from "./newGenLabels";
import { resolveNewGenCover } from "@ui/MapArtThumb/newGenCover";

describe("NewGen visual presentation", () => {
  it("uses Hungarian labels without changing English or unknown text", () => {
    expect(newGenLabel("Running", "hu")).toBe("Fut");
    expect(newGenLabel("Running", "en")).toBe("Running");
    expect(newGenLabel("Untamed Kingdom", "hu")).toBe("Untamed Kingdom");
    expect(newGenLabel("constructor", "hu")).toBe("constructor");
  });

  it("resolves bundled covers for the fleet and keeps custom-map fallback", () => {
    for (const map of [
      "TheIsland_WP",
      "ScorchedEarth_WP",
      "TheCenter_WP",
      "Aberration_WP",
      "Extinction_WP",
      "Ragnarok_WP",
      "Astraeos_WP",
      "Genesis_WP",
      "LostColony_WP",
      "Valguero_WP",
      "Asa_N_Chill_Hub",
    ]) {
      expect(resolveNewGenCover(map)).toBeTruthy();
    }
    expect(resolveNewGenCover("FutureMap_WP")).toBeNull();
    expect(resolveNewGenCover("constructor")).toBeNull();
  });
});
