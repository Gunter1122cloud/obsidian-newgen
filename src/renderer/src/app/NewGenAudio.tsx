import { useEffect, type ReactElement } from "react";
import { useNewGenVisualPreferences } from "./NewGenVisualPreferences";
import clickSound from "../assets/newgen/click.wav?url";
import noticeSound from "../assets/newgen/notice.wav?url";

export function NewGenAudio(): ReactElement | null {
  const { sound } = useNewGenVisualPreferences();

  useEffect(() => {
    if (!sound) return;
    let last = 0;
    const active = new Set<HTMLAudioElement>();
    const seen = new WeakSet<Element>();

    const play = (src: string) => {
      const now = Date.now();
      if (now - last < 90) return;
      last = now;
      const audio = new Audio(src);
      audio.volume = 0.22;
      active.add(audio);
      const release = () => active.delete(audio);
      audio.addEventListener("ended", release, { once: true });
      audio.addEventListener("error", release, { once: true });
      void audio.play().catch(release);
    };

    const click = (event: MouseEvent) => {
      const button =
        event.target instanceof Element ? event.target.closest("button, [role=button], [role=menuitem]") : null;
      if (button && !button.matches(":disabled, [aria-disabled=true], [data-disabled]")) play(clickSound);
    };

    document.querySelectorAll(".mantine-Notification-root").forEach((node) => seen.add(node));
    const observer = new MutationObserver(() => {
      for (const node of document.querySelectorAll(".mantine-Notification-root")) {
        if (seen.has(node)) continue;
        seen.add(node);
        play(noticeSound);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", click);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", click);
      for (const audio of active) audio.pause();
    };
  }, [sound]);

  return null;
}
