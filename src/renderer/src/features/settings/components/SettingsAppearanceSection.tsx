import type { ReactElement } from "react";
import { SegmentedControl, Switch, Text, Title } from "@mantine/core";
import { THEME_FAMILY_LIST, themeVariantsForFamily } from "@theme/themes";
import { isThemeFamilyId, isThemeScheme, isWorkspacePanelsId } from "@shared/settings/appearance";
import { WORKSPACE_PANELS_OPTION_LIST, resolveWorkspacePanelsOption } from "@shared/workspace/workspacePanels";
import type { ThemeFamilyId, ThemeScheme, UiDensity, WorkspacePanelsId } from "../settingsModel";
import classes from "../SettingsPage.module.css";
import { useNewGenVisualPreferences } from "@app/NewGenVisualPreferences";

interface Props {
  uiDensity: UiDensity;
  onUiDensityChange: (density: UiDensity) => void;
  family: ThemeFamilyId;
  onFamilyChange: (family: ThemeFamilyId) => void;
  scheme: ThemeScheme;
  onSchemeChange: (scheme: ThemeScheme) => void;
  workspacePanels: WorkspacePanelsId;
  onWorkspacePanelsChange: (panels: WorkspacePanelsId) => void;
  backgroundImage: boolean;
  onBackgroundImageChange: (enabled: boolean) => void;
}

/**
 * Appearance (#PUX-004 Track B, family split #PUX-005-B). Display size, theme
 * family, scheme, the Glassy background image, and where the server workspace
 * puts its panels. Every id control renders its registry, so shipping another
 * family, variant or option is data, not a UI change.
 */
export function SettingsAppearanceSection(props: Props): ReactElement {
  const visual = useNewGenVisualPreferences();
  return (
    <section className={classes.section} aria-labelledby="settings-appearance" data-settings-appearance>
      <Title order={3} size="h4" id="settings-appearance">
        {visual.text("Appearance", "Megjelenés")}
      </Title>
      <Text size="sm" c="dimmed">
        {visual.text(
          "Theme family, color scheme, display size and how the server workspace arranges its panels.",
          "Téma, színvilág, megjelenítési méret és a szerveroldal elrendezése.",
        )}
      </Text>

      <div className={classes.settingStack}>
        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Interface language (preview)", "Felület nyelve (előnézet)")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text(
                "Navigation, dashboard, workspace and common controls; some detailed text remains English.",
                "Navigáció, áttekintés, szerveroldal és közös vezérlők; egyes részletes szövegek még angolul jelennek meg.",
              )}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <SegmentedControl
              size="xs"
              value={visual.language}
              onChange={(value) => {
                if (value === "en" || value === "hu") visual.setLanguage(value);
              }}
              data={[
                { label: "English", value: "en" },
                { label: "Magyar", value: "hu" },
              ]}
              aria-label="Interface language"
            />
          </div>
        </div>
        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Interface animations", "Felületi animációk")}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <Switch
              checked={visual.motion}
              onChange={(event) => visual.setMotion(event.currentTarget.checked)}
              aria-label="Interface animations"
            />
          </div>
        </div>
        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Interface sounds", "Felületi hangok")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text("Play quiet interaction and notification sounds.", "Halk kattintási és értesítési hangok.")}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <Switch
              checked={visual.sound}
              onChange={(event) => visual.setSound(event.currentTarget.checked)}
              aria-label={visual.text("Interface sounds", "Felületi hangok")}
            />
          </div>
        </div>
        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Display size", "Megjelenítési méret")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text(
                "Compact fits more on screen. Comfortable uses larger type and spacing.",
                "A kompakt mód több adatot mutat; a kényelmes mód nagyobb betűket és térközt használ.",
              )}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <SegmentedControl
              size="xs"
              value={props.uiDensity}
              onChange={(value) => {
                if (value === "comfortable" || value === "compact") {
                  props.onUiDensityChange(value);
                }
              }}
              data={[
                { label: visual.text("Comfortable", "Kényelmes"), value: "comfortable" },
                { label: visual.text("Compact", "Kompakt"), value: "compact" },
              ]}
              aria-label="Display size"
            />
          </div>
        </div>

        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Theme family", "Témacsalád")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text("The visual language of the shell.", "A kezelőfelület vizuális stílusa.")}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <SegmentedControl
              size="xs"
              value={props.family}
              onChange={(value) => {
                if (isThemeFamilyId(value) && value !== props.family) {
                  props.onFamilyChange(value);
                }
              }}
              data={THEME_FAMILY_LIST.map((family) => ({ label: family.label, value: family.id }))}
              aria-label="Theme family"
            />
          </div>
        </div>

        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Color scheme", "Színséma")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text("Choose the light or dark scheme.", "Világos vagy sötét színséma.")}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <SegmentedControl
              size="xs"
              value={props.scheme}
              onChange={(value) => {
                if (isThemeScheme(value) && value !== props.scheme) {
                  props.onSchemeChange(value);
                }
              }}
              data={themeVariantsForFamily(props.family).map((theme) => ({ label: theme.label, value: theme.scheme }))}
              aria-label="Color scheme"
            />
          </div>
        </div>

        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Background image", "Háttérkép")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {visual.text(
                "Show the cinematic scene behind the dark interface. Off leaves a flat canvas.",
                "Filmszerű háttér a sötét felület mögött. Kikapcsolva egyszínű háttér.",
              )}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <Switch
              checked={props.backgroundImage}
              onChange={(event) => props.onBackgroundImageChange(event.currentTarget.checked)}
              aria-label="Background image"
            />
          </div>
        </div>

        <div className={classes.settingRow}>
          <div className={classes.settingCopy}>
            <Text size="sm" fw={600}>
              {visual.text("Server panels", "Szerverpanelek")}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {resolveWorkspacePanelsOption(props.workspacePanels).description}
            </Text>
          </div>
          <div className={classes.settingControl}>
            <SegmentedControl
              size="xs"
              value={props.workspacePanels}
              onChange={(value) => {
                if (isWorkspacePanelsId(value) && value !== props.workspacePanels) {
                  props.onWorkspacePanelsChange(value);
                }
              }}
              data={WORKSPACE_PANELS_OPTION_LIST.map((option) => ({ label: option.label, value: option.id }))}
              aria-label="Server panels"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
