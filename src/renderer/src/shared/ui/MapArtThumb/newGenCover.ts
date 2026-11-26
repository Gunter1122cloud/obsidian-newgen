import cover0 from "@renderer/assets/newgen/Astraeos_WP.svg";
import cover1 from "@renderer/assets/newgen/TheIsland_WP.svg";
import cover2 from "@renderer/assets/newgen/Valguero_WP.svg";
import cover3 from "@renderer/assets/newgen/Extinction_WP.svg";
import cover4 from "@renderer/assets/newgen/Genesis_WP.svg";
import cover5 from "@renderer/assets/newgen/Ragnarok_WP.svg";
import cover6 from "@renderer/assets/newgen/ScorchedEarth_WP.svg";
import cover7 from "@renderer/assets/newgen/LostColony_WP.svg";
import cover8 from "@renderer/assets/newgen/TheCenter_WP.svg";
import cover9 from "@renderer/assets/newgen/Aberration_WP.svg";
import cover10 from "@renderer/assets/newgen/Asa_N_Chill_Hub.svg";

const COVERS: Record<string, string> = {
  Astraeos_WP: cover0,
  TheIsland_WP: cover1,
  Valguero_WP: cover2,
  Extinction_WP: cover3,
  Genesis_WP: cover4,
  Ragnarok_WP: cover5,
  ScorchedEarth_WP: cover6,
  LostColony_WP: cover7,
  TheCenter_WP: cover8,
  Aberration_WP: cover9,
  Asa_N_Chill_Hub: cover10,
};

export function resolveNewGenCover(mapId: string): string | null {
  return Object.hasOwn(COVERS, mapId) ? (COVERS[mapId] ?? null) : null;
}
