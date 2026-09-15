import { memo } from "react";
import { Icon, IconButton } from "@chakra-ui/react";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { FiMoreVertical } from "@/shared/components/icons";
import type { IconType } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";

export interface ActionMenuItem {
  label: string;
  icon?: IconType;
  onClick: () => void;
  isDisabled?: boolean;
  isDanger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
}

function ActionMenuComponent({ items }: ActionMenuProps) {
  const { t } = useTranslation("common");
  const normalItems = items.filter((item) => !item.isDanger);
  const dangerItems = items.filter((item) => item.isDanger);

  return (
    <MenuRoot>
      {/* v3 drives the trigger with `asChild` instead of v2's `as={IconButton}`,
          and every item needs a stable `value` (it is the selection key). */}
      <MenuTrigger asChild>
        <IconButton
          aria-label={t("actions.actions")}
          variant="ghost"
          size="sm"
          borderRadius="md"
        >
          <FiMoreVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        {normalItems.map((item) => (
          <MenuItem
            key={item.label}
            value={item.label}
            onClick={item.onClick}
            disabled={item.isDisabled}
          >
            {item.icon ? (
              <Icon boxSize={4}>
                <item.icon />
              </Icon>
            ) : null}
            {item.label}
          </MenuItem>
        ))}
        {dangerItems.length > 0 && normalItems.length > 0 && <MenuSeparator />}
        {dangerItems.map((item) => (
          <MenuItem
            key={item.label}
            value={item.label}
            onClick={item.onClick}
            disabled={item.isDisabled}
            color="status.error.fg"
            _highlighted={{ bg: "status.error.bg", color: "status.error.fg" }}
          >
            {item.icon ? (
              <Icon boxSize={4} color="status.error.fg">
                <item.icon />
              </Icon>
            ) : null}
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

export const ActionMenu = memo(ActionMenuComponent);
