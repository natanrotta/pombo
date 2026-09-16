import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Code,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { buttonRecipe, semanticTokens, textStyles } from "@pombo/theme";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiInbox,
  FiSlash,
  FiSmartphone,
  FiTrash2,
} from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { EntityCard } from "@/shared/components/ui/EntityCard";
import { StatCard, type StatCardTone } from "@/shared/components/ui/StatCard";
import { InfoRow } from "@/shared/components/ui/InfoRow";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { FilterBar } from "@/shared/components/ui/FilterBar";
import { ActionMenu } from "@/shared/components/ui/ActionMenu";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { SaveButton } from "@/shared/components/ui/SaveButton";
import { ColorModeToggle } from "@/shared/components/ui/ColorModeToggle";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";
import { AppModal } from "@/shared/components/ui/AppModal";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { FormField } from "@/shared/components/forms/FormField";
import { PasswordField } from "@/shared/components/forms/PasswordField";
import { PasswordStrengthIndicator } from "@/shared/components/forms/PasswordStrengthIndicator";
import { SelectField } from "@/shared/components/forms/SelectField";
import { NumberField } from "@/shared/components/forms/NumberField";
import { TextAreaField } from "@/shared/components/forms/TextAreaField";
import { EntityCardSkeleton } from "@/shared/components/skeletons/EntityCardSkeleton";
import { SectionCardSkeleton } from "@/shared/components/skeletons/SectionCardSkeleton";
import { FilterBarSkeleton } from "@/shared/components/skeletons/FilterBarSkeleton";
import { useNotify } from "@/shared/hooks/useNotify";

/**
 * DEV-ONLY design-system gallery (`/dev/styleguide`, mounted only when
 * `import.meta.env.DEV`). Every shared primitive in every state, in one page,
 * so a design change can be judged — and snapshot-tested
 * (`e2e/tests/design-system/styleguide-visual.spec.ts`) — in light and dark.
 *
 * Token swatches are read from `@pombo/theme`, so they follow the design with
 * no edit here. Demo copy is literal pt-BR on purpose: this is a development
 * tool, not a product screen, so it stays out of the i18n catalog.
 */

type Leaf = { path: string };

function tokenPaths(node: unknown, prefix = ""): Leaf[] {
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, child]) =>
    child && typeof child === "object" && "value" in child
      ? [{ path: `${prefix}${key}` }]
      : tokenPaths(child, `${prefix}${key}.`),
  );
}

const colorTokens = tokenPaths(semanticTokens.colors);
const shadowTokens = tokenPaths(semanticTokens.shadows);
const textStyleNames = Object.keys(textStyles);
const buttonVariants = Object.keys(buttonRecipe.variants?.variant ?? {});
const BUTTON_SIZES = ["xs", "sm", "md"] as const;
const STATUSES = ["success", "info", "warning", "error", "neutral"] as const;
const STAT_TONES: StatCardTone[] = ["brand", "success", "info", "neutral", "error", "blue"];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Box
      as="section"
      data-cy={`styleguide-${id}`}
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
    >
      <Heading as="h2" textStyle="sectionTitle" mb={4}>
        {title}
      </Heading>
      {children}
    </Box>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <Text textStyle="caption" color="text.muted">
      {children}
    </Text>
  );
}

function TypographySection() {
  return (
    <Section id="typography" title="Tipografia">
      <Stack gap={3}>
        {textStyleNames.map((name) => (
          <Flex key={name} gap={4} align="baseline" wrap="wrap">
            <Code minW="120px">{name}</Code>
            <Text textStyle={name}>Pombo — gateway de mensagens</Text>
          </Flex>
        ))}
      </Stack>
    </Section>
  );
}

function ColorSection() {
  return (
    <Section id="colors" title="Cores semânticas">
      <SimpleGrid columns={{ base: 2, md: 4, xl: 6 }} gap={3}>
        {colorTokens.map(({ path }) => (
          <Stack key={path} gap={1}>
            <Box h={10} borderRadius="md" bg={path} borderWidth="1px" borderColor="border.subtle" />
            <Label>{path}</Label>
          </Stack>
        ))}
      </SimpleGrid>
    </Section>
  );
}

function ShadowSection() {
  return (
    <Section id="shadows" title="Sombras">
      <SimpleGrid columns={{ base: 2, md: 4 }} gap={6}>
        {shadowTokens.map(({ path }) => (
          <Stack key={path} gap={2}>
            <Box h={14} borderRadius="lg" bg="bg.elevated" boxShadow={path} />
            <Label>{path}</Label>
          </Stack>
        ))}
      </SimpleGrid>
    </Section>
  );
}

function ButtonSection() {
  return (
    <Section id="buttons" title="Botões">
      <Stack gap={4}>
        {buttonVariants.map((variant) => (
          <Flex key={variant} gap={3} align="center" wrap="wrap">
            <Code minW="80px">{variant}</Code>
            {BUTTON_SIZES.map((size) => (
              // The recipe adds variants Chakra's generated types don't know. Its
              // variants paint explicit tokens, so `colorPalette` only reaches the
              // states they leave to Chakra's defaults — mirroring the app's call sites.
              <Button key={size} size={size} variant={variant as "solid"} colorPalette="brand">
                {size}
              </Button>
            ))}
            <Button size="sm" variant={variant as "solid"} colorPalette="brand" disabled>
              desabilitado
            </Button>
            <Button size="sm" variant={variant as "solid"} colorPalette="brand" loading>
              carregando
            </Button>
          </Flex>
        ))}
      </Stack>
    </Section>
  );
}

function BadgeSection() {
  return (
    <Section id="badges" title="Status">
      <Flex gap={2} wrap="wrap">
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} label={status} />
        ))}
      </Flex>
    </Section>
  );
}

function FieldSection() {
  const [name, setName] = useState("Dispositivo principal");
  const [password, setPassword] = useState("Abc123!x");
  const [kind, setKind] = useState("text");
  const [count, setCount] = useState(3);
  const [notes, setNotes] = useState("");

  return (
    <Section id="fields" title="Campos">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <FormField label="Padrão" value={name} onChange={setName} />
        <FormField
          label="Com ajuda"
          value=""
          onChange={() => {}}
          placeholder="https://"
          helperText="Texto de apoio abaixo do campo."
        />
        <FormField label="Com erro" value="abc" onChange={() => {}} error="Formato inválido." />
        <FormField label="Desabilitado" value="somente leitura" onChange={() => {}} disabled />
        <Stack gap={2}>
          <PasswordField label="Senha" value={password} onChange={setPassword} />
          <PasswordStrengthIndicator password={password} />
        </Stack>
        <SelectField
          label="Seleção"
          value={kind}
          onChange={setKind}
          options={[
            { value: "text", label: "Texto" },
            { value: "image", label: "Imagem" },
          ]}
        />
        <NumberField label="Número" value={count} onChange={setCount} />
        <TextAreaField
          label="Texto longo"
          value={notes}
          onChange={setNotes}
          placeholder="Escreva algo…"
          helperText="Até 4096 caracteres."
        />
      </SimpleGrid>
    </Section>
  );
}

function CardSection() {
  return (
    <Section id="cards" title="Cards">
      <Stack gap={6}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {(["default", "glass", "sunken"] as const).map((variant) => (
            <SectionCard key={variant} variant={variant} p={4}>
              <Text textStyle="bodyStrong">SectionCard</Text>
              <Label>{variant}</Label>
            </SectionCard>
          ))}
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <EntityCard
            title="Atendimento"
            subtitle="+55 11 99999-0000"
            badges={[<StatusBadge key="s" status="success" label="Conectado" />]}
            metaItems={[{ icon: FiClock, label: "Conectado há 2 horas" }]}
            actionItems={[
              { label: "Editar", icon: FiEdit2, onClick: () => {} },
              { label: "Excluir", icon: FiTrash2, onClick: () => {}, isDanger: true },
            ]}
            onClick={() => {}}
          />
          <SectionCard p={4}>
            <Stack gap={3}>
              <InfoRow label="Número" value="+55 11 99999-0000" />
              <InfoRow
                label="Token"
                value="pmb_ab12…cd34"
                action={<CopyButton value="pmb_ab12cd34" ariaLabel="Copiar token" />}
              />
            </Stack>
          </SectionCard>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {STAT_TONES.map((tone, index) => (
            <StatCard
              key={tone}
              tone={tone}
              label={tone}
              value={String(index + 1)}
              hint="Dica do indicador"
              icon={[FiSmartphone, FiCheckCircle, FiActivity, FiInbox, FiSlash, FiSmartphone][index]}
            />
          ))}
        </SimpleGrid>
      </Stack>
    </Section>
  );
}

function StateSection() {
  return (
    <Section id="states" title="Estados">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
        <EmptyState
          title="Nenhum dispositivo"
          description="Crie o primeiro para começar a enviar mensagens."
          actionLabel="Adicionar"
          onAction={() => {}}
          size="sm"
        />
        <Stack gap={4}>
          <FilterBarSkeleton />
          <EntityCardSkeleton />
          <SectionCardSkeleton lines={2} />
        </Stack>
      </SimpleGrid>
    </Section>
  );
}

function ControlSection() {
  const [search, setSearch] = useState("");
  return (
    <Section id="controls" title="Controles">
      <Stack gap={6}>
        <PageHeader
          title="Título da página"
          description="Descrição curta do que a página faz."
          primaryAction={{ label: "Adicionar", onClick: () => {} }}
        />
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <Flex gap={4} align="center" wrap="wrap">
          <ActionMenu items={[{ label: "Editar", icon: FiEdit2, onClick: () => {} }]} />
          <CopyButton value="valor" ariaLabel="Copiar valor" />
          <SaveButton isDirty isSaving={false} onClick={() => {}} />
          <SaveButton isDirty={false} isSaving={false} onClick={() => {}} />
          <ColorModeToggle />
          <LanguageSelector />
        </Flex>
      </Stack>
    </Section>
  );
}

function OverlaySection() {
  const modal = useDisclosure();
  const confirm = useDisclosure();
  const { showSuccess, showInfo, showWarning, showError } = useNotify();

  return (
    <Section id="overlays" title="Sobreposições">
      <Flex gap={3} wrap="wrap">
        <Button size="sm" variant="outline" onClick={modal.onOpen}>
          Abrir modal
        </Button>
        <Button size="sm" variant="outline" onClick={confirm.onOpen}>
          Abrir confirmação
        </Button>
        <Button size="sm" variant="ghost" onClick={() => showSuccess("Salvo com sucesso")}>
          Toast success
        </Button>
        <Button size="sm" variant="ghost" onClick={() => showInfo("Informação")}>
          Toast info
        </Button>
        <Button size="sm" variant="ghost" onClick={() => showWarning("Atenção")}>
          Toast warning
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => showError(new Error("Algo deu errado"), "Algo deu errado")}
        >
          Toast error
        </Button>
      </Flex>
      <AppModal
        isOpen={modal.open}
        onClose={modal.onClose}
        title="Novo dispositivo"
        primaryActionLabel="Criar"
        onPrimaryAction={modal.onClose}
      >
        <Text>Conteúdo do modal.</Text>
      </AppModal>
      <ConfirmDialog
        isOpen={confirm.open}
        onClose={confirm.onClose}
        onConfirm={confirm.onClose}
        title="Excluir dispositivo?"
        description="Esta ação não pode ser desfeita."
      />
    </Section>
  );
}

export function StyleguidePage() {
  return (
    <Stack gap={6} pb={10}>
      <PageHeader title="Styleguide" description="Primitivos do design system em todos os estados." />
      <TypographySection />
      <ColorSection />
      <ShadowSection />
      <ButtonSection />
      <BadgeSection />
      <FieldSection />
      <CardSection />
      <StateSection />
      <ControlSection />
      <OverlaySection />
    </Stack>
  );
}
