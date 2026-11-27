import { useEffect, useState, type ReactElement } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import { Button, Switch, Text, Title } from "@mantine/core";
import { AppPathRow } from "@ui/AppPathRow/AppPathRow";
import { ReadonlyPath } from "@ui/ReadonlyPath/ReadonlyPath";
import { DEFAULT_BASE_FOLDER_ATTR } from "../settingsTestIds";
import classes from "../SettingsPage.module.css";

interface Props {
  openNativeTerminalOnStart: boolean;
  onOpenNativeTerminalOnStartChange: (enabled: boolean) => void;
  defaultBaseFolder: string | null;
  onDefaultBaseFolderChange: (path: string | null) => void;
  onPickDefaultBaseFolder: () => void;
}

export function SettingsServersSection(props: Props): ReactElement {
  const [optimizeRam, setOptimizeRam] = useState(false);
  useEffect(() => {
    void window.api?.getOptimizeRamBeforeStart?.().then((result) => {
      if (result.ok) setOptimizeRam(result.data);
    }).catch(() => undefined);
  }, []);
  return (
    <section className={classes.section} aria-labelledby="settings-servers">
      <Title order={3} size="h4" id="settings-servers">
        Profiles
      </Title>

      <div className={classes.settingStack}>
        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              Show server console on start
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              Opens the ARK dedicated-server console window when a server starts, including Start, Restart, and
              Auto-start with YARK.
            </Text>
          </div>
          <div className={classes.settingControl}>
            <Switch
              checked={props.openNativeTerminalOnStart}
              onChange={(event) => props.onOpenNativeTerminalOnStartChange(event.currentTarget.checked)}
              aria-label="Show native console when a server starts"
            />
          </div>
        </div>

        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>Optimize system RAM before starting a server</Text>
            <Text size="xs" c="dimmed" mt={2}>
              Flushes unused memory from background processes before each server launch to free up physical RAM. May cause a brief pause.
            </Text>
          </div>
          <div className={classes.settingControl}>
            <Switch
              checked={optimizeRam}
              aria-label="Optimize system RAM before starting a server"
              onChange={(event) => {
                void window.api.setOptimizeRamBeforeStart(event.currentTarget.checked).then((result) => {
                  if (result.ok) setOptimizeRam(result.data);
                }).catch(() => undefined);
              }}
            />
          </div>
        </div>

        <div className={classes.settingBlock}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              Default base folder
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              New servers are created here, each in its own named subfolder.
            </Text>
          </div>
          <AppPathRow
            {...{ [DEFAULT_BASE_FOLDER_ATTR]: true }}
            actions={
              <>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<FolderOpen size={14} />}
                  onClick={props.onPickDefaultBaseFolder}
                >
                  Choose…
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={props.defaultBaseFolder === null}
                  onClick={() => props.onDefaultBaseFolderChange(null)}
                >
                  Clear
                </Button>
              </>
            }
          >
            <ReadonlyPath
              value={props.defaultBaseFolder}
              emptyLabel="Not set - choose a folder when creating a server"
            />
          </AppPathRow>
        </div>
      </div>
    </section>
  );
}
