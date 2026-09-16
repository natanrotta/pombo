import { memo, useMemo } from "react";
import {
  Flex,
  Icon,
  IconButton,
  Input,
  Text,
  useDisclosure,
  type InputProps,
} from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import {
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  PopoverRoot,
} from "@/components/ui/popover";
import { useTranslation } from "react-i18next";
import { FiClock, FiX } from "@/shared/components/icons";
import { formatPhoneDisplay, unformatPhone } from "@/shared/utils/phone";

interface RecipientNumberFieldProps extends Omit<
  InputProps,
  "onChange" | "value"
> {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Recently used recipients as raw digits, most-recent first. */
  recents: string[];
  /** Fired when a suggestion is picked (raw digits). */
  onSelectRecent: (digits: string) => void;
  /** Fired when a suggestion is dismissed via its × (raw digits). */
  onRemoveRecent: (digits: string) => void;
}

/**
 * Recipient phone input with a "recently sent" suggestion dropdown. On focus it
 * surfaces the browser-cached recents (see `useRecentRecipients`), narrowing as
 * the user types; picking one fills the field. Structurally a controlled
 * combobox — the `Input` is the `PopoverAnchor`, open state is driven by focus,
 * and rows use `onMouseDown`+preventDefault so a click doesn't blur the field
 * before it registers.
 */
function RecipientNumberFieldComponent({
  label,
  error,
  value,
  onChange,
  recents,
  onSelectRecent,
  onRemoveRecent,
  ...inputProps
}: RecipientNumberFieldProps) {
  const { t } = useTranslation("sandbox");
  const { open: isOpen, onOpen, onClose } = useDisclosure();

  const typedDigits = unformatPhone(value);
  const suggestions = useMemo(
    () =>
      recents.filter((digits) =>
        // While typing, keep only recents that contain the typed digits (and
        // aren't already an exact match); empty input shows all recents.
        typedDigits
          ? digits.includes(typedDigits) && digits !== typedDigits
          : true,
      ),
    [recents, typedDigits],
  );

  const showSuggestions = isOpen && suggestions.length > 0;

  return (
    <Field invalid={Boolean(error)} label={label} errorText={error}>
      <PopoverRoot
        open={showSuggestions}
        onOpenChange={({ open }) => {
          if (!open) onClose();
        }}
        positioning={{ placement: "bottom-start", sameWidth: true }}
        autoFocus={false}
        lazyMount
        unmountOnExit
      >
        {/* F-H6 exception: `FormField` can't host an input wrapped in
            `PopoverAnchor`, so this composes `Field` + `Input` directly. */}
        <PopoverAnchor>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onOpen}
            onBlur={onClose}
            autoComplete="off"
            {...inputProps}
          />
        </PopoverAnchor>
        <PopoverContent
          w="100%"
          borderWidth="1.5px"
          borderColor="border.default"
          borderRadius="lg"
          boxShadow="shadow.card"
          _focusVisible={{ outline: "none" }}
        >
          <PopoverBody p={1}>
            <Text
              px={3}
              pt={1.5}
              pb={1}
              fontSize="10px"
              fontWeight="700"
              letterSpacing="0.06em"
              textTransform="uppercase"
              color="text.muted"
            >
              {t("recent.title")}
            </Text>
            <Flex direction="column" maxH="220px" overflowY="auto">
              {suggestions.map((digits) => (
                <Flex
                  key={digits}
                  align="center"
                  gap={2}
                  px={3}
                  py={2}
                  borderRadius="xs"
                  cursor="pointer"
                  role="button"
                  transition="background 0.15s ease"
                  _hover={{ bg: "bg.hover" }}
                  // Keep focus on the input so onBlur doesn't close before onClick.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelectRecent(digits);
                    onClose();
                  }}
                >
                  <Icon boxSize={3.5} color="text.muted" flexShrink={0}>
                    <FiClock />
                  </Icon>
                  <Text fontSize="sm" color="text.primary" flex={1}>
                    {formatPhoneDisplay(digits)}
                  </Text>
                  <IconButton
                    aria-label={t("recent.remove")}
                    size="xs"
                    variant="ghost"
                    color="text.muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveRecent(digits);
                    }}
                  >
                    <Icon boxSize={3.5}>
                      <FiX />
                    </Icon>
                  </IconButton>
                </Flex>
              ))}
            </Flex>
          </PopoverBody>
        </PopoverContent>
      </PopoverRoot>
    </Field>
  );
}

export const RecipientNumberField = memo(RecipientNumberFieldComponent);
