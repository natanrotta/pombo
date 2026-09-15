import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, IconButton } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  FiBold,
  FiCode,
  FiItalic,
  FiList,
  FiUnderline,
  LuHeading2,
  LuListOrdered,
  LuQuote,
} from "@/shared/components/icons";
import { normalizeTiptapHtml } from "./normalizeTiptapHtml";

interface RichTextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isReadOnly?: boolean;
  minHeight?: string;
}

export function RichTextField({
  label,
  value,
  onChange,
  placeholder,
  isReadOnly = false,
  minHeight = "200px",
}: RichTextFieldProps) {
  const { t } = useTranslation("common");
  const resolvedPlaceholder = placeholder ?? t("forms.richText.placeholder");
  const isInternalChange = useRef(false);
  const isInitializedRef = useRef(false);
  // Last value we surfaced via `onChange` (normalized). Suppresses duplicate
  // emits — tiptap can re-fire `onUpdate` with identical HTML during
  // initialization, focus transitions, or schema reconciliation, and each
  // duplicate would round-trip through the parent's autosave loop.
  const lastEmittedRef = useRef<string>(normalizeTiptapHtml(value));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
      Underline,
    ],
    content: value || "",
    editable: !isReadOnly,
    onCreate: () => {
      isInitializedRef.current = true;
    },
    onUpdate: ({ editor: e }) => {
      if (!isInitializedRef.current) return;
      const normalized = normalizeTiptapHtml(e.getHTML());
      if (normalized === lastEmittedRef.current) return;
      lastEmittedRef.current = normalized;
      isInternalChange.current = true;
      onChange(normalized);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    // Compare normalized on both sides — `value=""` vs `currentHTML="<p></p>"`
    // are semantically equal and must not trigger a redundant setContent.
    // Without this, every re-render with `value=""` would re-issue
    // `setContent("")` on an already-empty editor.
    const normalizedValue = normalizeTiptapHtml(value);
    const normalizedCurrent = normalizeTiptapHtml(currentHTML);
    if (normalizedValue !== normalizedCurrent) {
      // `emitUpdate: false` is load-bearing here — without it, tiptap
      // would synchronously call our `onUpdate` during `setContent`,
      // BEFORE the `lastEmittedRef` line below runs. The dedup gate
      // would then see the stale ref, mistake the programmatic change
      // for a fresh user edit, and re-fire `onChange`. Removing this
      // flag silently regresses the phantom-autosave fix.
      editor.commands.setContent(value || "", { emitUpdate: false });
      // External value change (e.g. parent reset after a save) — keep the
      // dedup gate in sync so a follow-up onUpdate with the same content
      // is correctly skipped instead of re-firing onChange.
      lastEmittedRef.current = normalizedValue;
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadOnly);
  }, [isReadOnly, editor]);

  if (!editor) return null;

  const content = (
    <Box
      className="rich-text-editor"
      borderWidth="1.5px"
      borderColor="border.default"
      borderRadius="sm"
      bg={isReadOnly ? "bg.muted" : "bg.surface"}
      _hover={!isReadOnly ? { borderColor: "border.strong" } : undefined}
      _focusWithin={
        !isReadOnly
          ? {
              borderColor: "border.focus",
              boxShadow: "input-focus",
            }
          : undefined
      }
      transition="all 0.2s cubic-bezier(0.22, 1, 0.36, 1)"
      overflow="hidden"
    >
      {!isReadOnly && <Toolbar editor={editor} />}
      {/* The content wrapper itself owns the vertical resize. `resize` needs a
          non-visible overflow on the SAME element, so it pairs with
          overflow:auto here (which also lets the editor scroll when dragged
          shorter than its content). Read-only views aren't resizable. */}
      <Box
        resize={isReadOnly ? undefined : "vertical"}
        overflow={isReadOnly ? undefined : "auto"}
        css={{ ".ProseMirror": { minHeight } }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );

  if (!label) return content;

  return <Field label={label}>{content}</Field>;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { t } = useTranslation("common");

  if (!editor) return null;

  const items = [
    {
      icon: FiBold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
      label: t("forms.richText.bold"),
    },
    {
      icon: FiItalic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
      label: t("forms.richText.italic"),
    },
    {
      icon: FiUnderline,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive("underline"),
      label: t("forms.richText.underline"),
    },
    {
      icon: LuHeading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive("heading", { level: 2 }),
      label: t("forms.richText.heading"),
    },
    {
      icon: FiList,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList"),
      label: t("forms.richText.bulletList"),
    },
    {
      icon: LuListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList"),
      label: t("forms.richText.orderedList"),
    },
    {
      icon: LuQuote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive("blockquote"),
      label: t("forms.richText.blockquote"),
    },
    {
      icon: FiCode,
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive("code"),
      label: t("forms.richText.code"),
    },
  ];

  return (
    <Flex
      gap={0.5}
      px={2}
      py={1.5}
      borderBottomWidth="1px"
      borderColor="border.default"
      bg="bg.sunken"
      flexWrap="wrap"
    >
      {items.map((item) => (
        <IconButton
          key={item.label}
          aria-label={item.label}
          size="xs"
          variant={item.isActive ? "solid" : "ghost"}
          colorPalette={item.isActive ? "brand" : "gray"}
          onClick={item.action}
        >
          <item.icon size={15} />
        </IconButton>
      ))}
    </Flex>
  );
}
