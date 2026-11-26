import { useNewGenVisualPreferences } from "@app/NewGenVisualPreferences";
import { newGenLabel } from "@app/newGenLabels";
import type { ReactElement } from "react";
import { Tabs } from "@mantine/core";
import { allWorkspaceTabs } from "../../model/workspaceTabGroups";
import classes from "../../ServerWorkspacePage.module.css";

export function WorkspaceTabList(): ReactElement {
  const { language } = useNewGenVisualPreferences();
  return (
    <div className={classes.tabChrome}>
      <Tabs.List className={classes.tabList} aria-label={newGenLabel("Workspace tabs", language)}>
        {allWorkspaceTabs().map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value}>
            {newGenLabel(tab.label, language)}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </div>
  );
}
