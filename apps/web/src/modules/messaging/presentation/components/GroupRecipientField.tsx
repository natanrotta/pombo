import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ErrorCodes } from "@pombo/shared-types";
import { AppError } from "@/core/errors/AppError";
import { SelectField } from "@/shared/components/forms/SelectField";
import { useDeviceGroups } from "@/modules/devices";

interface GroupRecipientFieldProps {
  deviceId: string;
  value: string;
  onChange: (groupJid: string) => void;
  error?: string;
}

/**
 * Group picker for the "group" message type. Mounted only while that type is
 * active, so the groups (which need the device's live socket) are fetched only
 * then. The placeholder carries the list's state: loading, empty, offline
 * device, or any other failure.
 */
export function GroupRecipientField({
  deviceId,
  value,
  onChange,
  error,
}: GroupRecipientFieldProps) {
  const { t } = useTranslation("sandbox");
  const groupsQuery = useDeviceGroups(deviceId, true);

  const options = useMemo(
    () =>
      (groupsQuery.data ?? []).map((group) => ({
        value: group.jid,
        label: group.name || group.jid,
      })),
    [groupsQuery.data],
  );

  const isOffline =
    groupsQuery.error instanceof AppError &&
    groupsQuery.error.code === ErrorCodes.DEVICE_OFFLINE;
  const placeholder = isOffline
    ? t("fields.groupOffline")
    : groupsQuery.isError
      ? t("fields.groupError")
      : groupsQuery.isLoading
        ? t("fields.groupLoading")
        : options.length === 0
          ? t("fields.groupEmpty")
          : t("fields.groupPlaceholder");

  return (
    <SelectField
      label={t("fields.group")}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
