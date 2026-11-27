import { ActionIcon, Button, Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import { Clock } from "@phosphor-icons/react";
import type { MaintenancePolicyStatus } from "@shared/types";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import { ALL_RESTART_DAYS_OF_WEEK, DAY_SHORT, normalizeRestartDaysOfWeek } from "../../model/maintenancePanelModel";
import classes from "../../MaintenancePanel.module.css";

interface Props {
  policy: MaintenancePolicyStatus;
  disabled: boolean;
  onPatchDays: (days: number[]) => void;
  onPatchTime: (timeLocal: string) => void;
  onPatchTimers: (timers: NonNullable<MaintenancePolicyStatus["additionalRestartTimers"]>) => void;
  onPatchPrimaryEnabled: (enabled: boolean) => void;
}

/** Restart schedule: multi-day + Mantine TimePicker (#315). */
export function MaintenanceRestartSchedule({
  policy,
  disabled,
  onPatchDays,
  onPatchTime,
  onPatchTimers,
  onPatchPrimaryEnabled,
}: Props): ReactElement {
  const [timeDropdownOpened, setTimeDropdownOpened] = useState(false);
  const [timeLocal, setTimeLocal] = useState(policy.restartTimeLocal);
  const days = normalizeRestartDaysOfWeek(policy.restartDaysOfWeek);
  const everyDay = days.length === 7;
  const timers = policy.additionalRestartTimers ?? [];

  useEffect(() => {
    setTimeLocal(policy.restartTimeLocal);
  }, [policy.restartTimeLocal]);

  const commitTimeIfChanged = useCallback(() => {
    if (timeLocal !== policy.restartTimeLocal) {
      onPatchTime(timeLocal);
    }
  }, [timeLocal, policy.restartTimeLocal, onPatchTime]);

  return (
    <Stack gap="sm">
      <Checkbox
        label="Enable primary restart timer"
        checked={policy.primaryRestartEnabled !== false}
        disabled={disabled}
        onChange={(event) => onPatchPrimaryEnabled(event.currentTarget.checked)}
      />
      <div>
        <Text className={classes.fieldLabel}>On these days</Text>
        <Text size="xs" c="dimmed" mt={2}>
          Pick one or more days.
        </Text>
      </div>
      <Group gap={6} wrap="wrap">
        <Button
          variant={everyDay ? "light" : "default"}
          disabled={disabled}
          onClick={() => onPatchDays([...ALL_RESTART_DAYS_OF_WEEK])}
        >
          Every day
        </Button>
        {DAY_SHORT.map((label, dow) => {
          const on = days.includes(dow);
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              className={`${classes.offsetChip}${on ? ` ${classes.offsetChipOn}` : ""}`}
              onClick={() => {
                const next = on ? days.filter((d) => d !== dow) : [...days, dow];
                if (next.length === 0) return;
                onPatchDays(normalizeRestartDaysOfWeek(next));
              }}
            >
              {label}
            </button>
          );
        })}
      </Group>
      <TimePicker
        label="Restart time"
        value={timeLocal}
        onChange={(value) => {
          const hhmm = value?.slice(0, 5);
          if (hhmm !== undefined && /^\d{2}:\d{2}$/.test(hhmm)) {
            setTimeLocal(hhmm);
          }
        }}
        disabled={disabled}
        size="xs"
        w={200}
        format="24h"
        withSeconds={false}
        withDropdown
        onBlur={() => {
          if (!timeDropdownOpened) commitTimeIfChanged();
        }}
        rightSection={
          <ActionIcon
            variant="default"
            size="sm"
            disabled={disabled}
            aria-label="Open time list"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setTimeDropdownOpened(true)}
          >
            <Clock size={16} aria-hidden />
          </ActionIcon>
        }
        popoverProps={{
          opened: timeDropdownOpened,
          onChange: (opened) => {
            if (!opened) {
              setTimeDropdownOpened(false);
              commitTimeIfChanged();
            }
          },
        }}
      />
      <Text fw={600} size="sm">
        Additional daily restart timers
      </Text>
      {timers.map((timer, index) => (
        <Group key={index} gap="xs" align="center" wrap="wrap">
          <Checkbox
            label="Enabled"
            checked={timer.enabled}
            disabled={disabled}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              onPatchTimers(timers.map((row, i) => (i === index ? { ...row, enabled } : row)));
            }}
          />
          <TextInput
            aria-label={`Restart time ${index + 2}`}
            type="time"
            size="xs"
            w={120}
            key={timer.timeLocal}
            defaultValue={timer.timeLocal}
            disabled={disabled}
            onBlur={(event) => {
              const timeLocal = event.currentTarget.value;
              if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeLocal) ||
                  timeLocal === policy.restartTimeLocal ||
                  timers.some((row, i) => i !== index && row.timeLocal === timeLocal)) {
                event.currentTarget.value = timer.timeLocal;
                return;
              }
              if (timeLocal !== timer.timeLocal) {
                onPatchTimers(timers.map((row, i) => (i === index ? { ...row, timeLocal } : row)));
              }
            }}
          />
          <Checkbox
            label="Wild dino wipe"
            checked={timer.wipeEnabled}
            disabled={disabled}
            onChange={(event) => {
              const wipeEnabled = event.currentTarget.checked;
              onPatchTimers(timers.map((row, i) => (i === index ? { ...row, wipeEnabled } : row)));
            }}
          />
          <Button size="xs" variant="subtle" disabled={disabled} onClick={() => onPatchTimers(timers.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </Group>
      ))}
      <Button
        size="xs"
        variant="light"
        disabled={disabled || timers.length >= 24}
        onClick={() => {
          const used = new Set([policy.restartTimeLocal, ...timers.map((timer) => timer.timeLocal)]);
          const timeLocal = Array.from({ length: 1440 }, (_, i) => {
            const minute = (15 * 60 + i) % 1440;
            return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
          }).find((time) => !used.has(time));
          if (timeLocal !== undefined) onPatchTimers([...timers, { timeLocal, enabled: true, wipeEnabled: false }]);
        }}
      >
        Add restart timer
      </Button>
    </Stack>
  );
}
