import { memo } from "react";
import { IconButton, Input, InputGroup } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/ui/field";
import { FiEye, FiEyeOff } from "@/shared/components/icons";

interface PasswordFieldProps {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

function PasswordFieldComponent({
  label,
  value,
  error,
  onChange,
  placeholder,
  autoComplete,
}: PasswordFieldProps) {
  const { t } = useTranslation("common");
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Field invalid={Boolean(error)} label={label} errorText={error}>
      <InputGroup
        endElement={
          <IconButton
            aria-label={
              isVisible ? t("forms.hidePassword") : t("forms.showPassword")
            }
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible((state) => !state)}
          >
            {isVisible ? <FiEyeOff /> : <FiEye />}
          </IconButton>
        }
      >
        <Input
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      </InputGroup>
    </Field>
  );
}

export const PasswordField = memo(PasswordFieldComponent);
