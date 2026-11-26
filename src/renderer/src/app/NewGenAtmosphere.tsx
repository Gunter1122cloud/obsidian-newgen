import type { ReactElement } from "react";
import { useNewGenVisualPreferences } from "./NewGenVisualPreferences";
import classes from "./NewGenAtmosphere.module.css";

export function NewGenAtmosphere({ enabled }: { enabled: boolean }): ReactElement | null {
  const { motion } = useNewGenVisualPreferences();
  if (!enabled || !motion) return null;
  return (
    <div className={classes.atmosphere} aria-hidden="true" data-newgen-atmosphere>
      <div className={classes.smoke} />
      <div className={classes.particles} />
      <div className={classes.sweep} />
    </div>
  );
}
