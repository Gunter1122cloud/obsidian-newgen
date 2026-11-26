import type { ReactElement } from "react";
import { useNewGenVisualPreferences } from "@app/NewGenVisualPreferences";
import { Button, Group, Text, VisuallyHidden } from "@mantine/core";
import { AppPageHeader } from "@ui/AppPageHeader/AppPageHeader";
import { AddServerSplitButton } from "@features/servers/components/AddServerSplitButton/AddServerSplitButton";
import { formatCpuPercent, formatWorkingSet } from "@features/servers/model/serverCardProcessMeta";
import classes from "../OverviewPage.module.css";

interface Props {
  onCreateServer: () => void;
  onImportServer: () => void;
  onCheckUpdates: () => void;
  onCheckInstalls: () => void;
  onUpdateAllOutdated?: () => void;
  checkingUpdates?: boolean;
  checkingInstalls?: boolean;
  canUpdateAllOutdated?: boolean;
  openingUpdateAllOutdated?: boolean;
  /**
   * Empty fleet: let the EmptyState own the single New server action.
   */
  emptyFleet?: boolean;
  /** Known online survivors across running servers; `null` until a real RCON sample exists. */
  survivorsOnlineTotal?: number | null;
  /**
   * When false (no starting/running enabled server), hide Survivors / RAM / CPU (#301 / #302).
   */
  showProcessFleetMetrics?: boolean;
  /** Sum of working set on starting/running servers; `null` until a real sample exists (#302). */
  fleetRamBytes?: number | null;
  /** Sum of per-process CPU % (one logical processor each) (#302). */
  fleetCpuPercent?: number | null;
}

export function OverviewHeader({
  onCreateServer,
  onImportServer,
  onCheckUpdates,
  onCheckInstalls,
  onUpdateAllOutdated,
  checkingUpdates = false,
  checkingInstalls = false,
  canUpdateAllOutdated = false,
  openingUpdateAllOutdated = false,
  emptyFleet = false,
  survivorsOnlineTotal = null,
  showProcessFleetMetrics = false,
  fleetRamBytes = null,
  fleetCpuPercent = null,
}: Props): ReactElement {
  const { text } = useNewGenVisualPreferences();
  const survivorsLabel =
    survivorsOnlineTotal == null
      ? text("Survivors –", "Játékosok –")
      : survivorsOnlineTotal === 1
        ? text("1 survivor online", "1 aktív játékos")
        : text(`${survivorsOnlineTotal} survivors online`, `${survivorsOnlineTotal} aktív játékos`);
  const ramLabel = fleetRamBytes == null ? "RAM –" : `RAM ${formatWorkingSet(fleetRamBytes)}`;
  const cpuLabel = fleetCpuPercent == null ? "CPU –" : `CPU ${formatCpuPercent(fleetCpuPercent)}`;

  return (
    <AppPageHeader
      title={text("Servers", "Szerverek")}
      className={classes.header}
      actions={
        <Group gap="md" wrap="wrap" justify="flex-end">
          {showProcessFleetMetrics ? (
            <Group gap="sm" wrap="wrap" className={classes.fleetReadouts}>
              <Text
                size="sm"
                c="dimmed"
                className={classes.fleetReadout}
                data-survivors-online={survivorsOnlineTotal == null ? undefined : survivorsOnlineTotal}
              >
                {survivorsLabel}
              </Text>
              <Text
                size="sm"
                c="dimmed"
                className={classes.fleetReadout}
                data-fleet-ram={fleetRamBytes == null ? undefined : fleetRamBytes}
                title="Sum of dedicated-process working set on starting/running servers"
              >
                {ramLabel}
              </Text>
              <Text
                size="sm"
                c="dimmed"
                className={classes.fleetReadout}
                data-fleet-cpu={fleetCpuPercent == null ? undefined : fleetCpuPercent}
                title="Sum of dedicated-process CPU % (each % of one logical processor)"
              >
                {cpuLabel}
              </Text>
            </Group>
          ) : null}
          <Button
            variant="transparent"
            color="gray"
            classNames={{
              root: classes.headerActionButton,
              label: classes.headerActionButtonLabel,
            }}
            onClick={onCheckInstalls}
            loading={checkingInstalls}
            data-install-health-scan={checkingInstalls || undefined}
            aria-busy={checkingInstalls || undefined}
          >
            {checkingInstalls
              ? text("Checking servers health…", "Szerverek ellenőrzése…")
              : text("Check Servers Health", "Szerverek ellenőrzése")}
          </Button>
          {checkingInstalls ? (
            <VisuallyHidden component="span" role="status" aria-live="polite">
              Checking servers health…
            </VisuallyHidden>
          ) : null}
          <Button
            variant="transparent"
            color="gray"
            classNames={{
              root: classes.headerActionButton,
              label: classes.headerActionButtonLabel,
            }}
            onClick={onCheckUpdates}
            loading={checkingUpdates}
          >
            {text("Check server updates", "Frissítések keresése")}
          </Button>
          {onUpdateAllOutdated !== undefined && canUpdateAllOutdated ? (
            <Button
              variant="transparent"
              color="gray"
              classNames={{
                root: classes.headerActionButton,
                label: classes.headerActionButtonLabel,
              }}
              onClick={onUpdateAllOutdated}
              disabled={openingUpdateAllOutdated}
              loading={openingUpdateAllOutdated}
            >
              {text("Update All", "Összes frissítése")}
            </Button>
          ) : null}
          {!emptyFleet ? (
            <AddServerSplitButton
              primaryLabel={text("New server", "Új szerver")}
              onCreate={onCreateServer}
              onImport={onImportServer}
              menuAriaLabel="More new-server options"
            />
          ) : null}
        </Group>
      }
    />
  );
}
