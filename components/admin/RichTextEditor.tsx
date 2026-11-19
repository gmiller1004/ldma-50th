"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

const ALLOWED_HREF = /^(https?:\/\/|mailto:|tel:)/i;

function isAllowedTrainerHref(url: string): boolean {
  const href = url.trim();
  if (!ALLOWED_HREF.test(href)) return false;
  return !/[\s<>"']/.test(href);
}

type BlockKind = "p" | "h1" | "h2" | "h3";

const BLOCKS: { id: BlockKind; label: string; short: string }[] = [
  { id: "p", label: "Paragraph", short: "Paragraph" },
  { id: "h1", label: "Heading 1", short: "H1" },
  { id: "h2", label: "Heading 2", short: "H2" },
  { id: "h3", label: "Heading 3", short: "H3" },
];

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  labelledBy?: string;
};

export function RichTextEditor({ value, onChange, labelledBy }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer" },
        isAllowedUri: (url) => isAllowedTrainerHref(url),
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "trainer-prose min-h-64 px-4 py-3 outline-none",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getHTML());
    },
  });

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      let block: BlockKind = "p";
      if (current.isActive("heading", { level: 1 })) block = "h1";
      else if (current.isActive("heading", { level: 2 })) block = "h2";
      else if (current.isActive("heading", { level: 3 })) block = "h3";
      return {
        block,
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        link: current.isActive("link"),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        quote: current.isActive("blockquote"),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });

  function setBlock(kind: BlockKind) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (kind === "p") chain.setParagraph().run();
    else if (kind === "h1") chain.setHeading({ level: 1 }).run();
    else if (kind === "h2") chain.setHeading({ level: 2 }).run();
    else chain.setHeading({ level: 3 }).run();
  }

  function editLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href;
    const entered = window.prompt(
      "Link URL. Use http://, https://, mailto:, or tel:. Leave blank to remove the link.",
      typeof previous === "string" && previous ? previous : "https://"
    );
    if (entered === null) return;
    const href = entered.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!isAllowedTrainerHref(href)) {
      window.alert("Links must start with http://, https://, mailto:, or tel:.");
      return;
    }
    const external = /^https?:\/\//i.test(href);
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href,
        rel: "noopener noreferrer",
        target: external ? "_blank" : null,
      })
      .run();
  }

  const ready = Boolean(editor && toolbar);

  return (
    <div className="rounded-lg border border-[#d4af37]/30 overflow-hidden focus-within:ring-2 focus-within:ring-[#d4af37]/50">
      <style>{`
        :where(.trainer-prose) {
          color: #f3ead7;
          background: #24180f;
          line-height: 1.6;
        }
        :where(.trainer-prose) > * + * { margin-top: 0.75rem; }
        :where(.trainer-prose) h1 { font-size: 1.75rem; line-height: 1.25; font-weight: 700; }
        :where(.trainer-prose) h2 { font-size: 1.35rem; line-height: 1.3; font-weight: 700; }
        :where(.trainer-prose) h3 { font-size: 1.1rem; line-height: 1.35; font-weight: 600; }
        :where(.trainer-prose) ul { list-style: disc; padding-left: 1.25rem; }
        :where(.trainer-prose) ol { list-style: decimal; padding-left: 1.25rem; }
        :where(.trainer-prose) blockquote {
          border-left: 2px solid #d4af37;
          padding-left: 0.75rem;
          color: #e8e0d5;
        }
        :where(.trainer-prose) a { color: #f0d48f; text-decoration: underline; }
      `}</style>
      <div
        role="toolbar"
        aria-label="Bio formatting"
        className="flex flex-wrap items-center gap-1 border-b border-[#d4af37]/20 bg-[#120e0a] p-2"
      >
        <div role="radiogroup" aria-label="Text style" className="flex items-center gap-1">
          {BLOCKS.map((block) => (
            <button
              key={block.id}
              type="button"
              role="radio"
              aria-label={block.label}
              aria-checked={toolbar?.block === block.id}
              disabled={!ready}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setBlock(block.id)}
              className={toolClass(toolbar?.block === block.id)}
            >
              {block.short}
            </button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-[#d4af37]/25" aria-hidden />
        <ToolButton label="Bold" pressed={toolbar?.bold} disabled={!ready} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Italic" pressed={toolbar?.italic} disabled={!ready} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Underline" pressed={toolbar?.underline} disabled={!ready} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={toolbar?.link ? "Edit link" : "Add link"} pressed={toolbar?.link} disabled={!ready} onClick={editLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-[#d4af37]/25" aria-hidden />
        <ToolButton label="Bullet list" pressed={toolbar?.bullet} disabled={!ready} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Numbered list" pressed={toolbar?.ordered} disabled={!ready} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Blockquote" pressed={toolbar?.quote} disabled={!ready} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Clear formatting"
          disabled={!ready}
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-[#d4af37]/25" aria-hidden />
        <ToolButton label="Undo" disabled={!ready || !toolbar?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!ready || !toolbar?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="min-h-64 bg-[#24180f]" aria-hidden />
      )}
    </div>
  );
}

function toolClass(active?: boolean): string {
  return [
    "rounded-md px-2 py-1.5 text-xs font-semibold text-[#e8e0d5]",
    "hover:bg-[#d4af37]/20 hover:text-[#f0d48f]",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#d4af37]",
    active ? "bg-[#d4af37]/25 text-[#f0d48f]" : "",
  ].join(" ");
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={toolClass(pressed)}
    >
      {children}
    </button>
  );
}
