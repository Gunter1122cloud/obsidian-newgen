import chillHubCover from "@renderer/assets/newgen/Asa_N_Chill_Hub.svg";
import { resolveMapArtUrl } from "./mapArt";

/** Real bundled ASA landscape artwork for known maps; Chillhub keeps its own original illustration. */
export function resolveNewGenCover(mapId: string): string | null {
  const key = mapId.trim();
  if (key === "Asa_N_Chill_Hub") {
    return chillHubCover;
  }
  return resolveMapArtUrl(key);
}
