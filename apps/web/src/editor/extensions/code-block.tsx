'use client';

import { CODE_LANGUAGES } from '@skytech/contracts';
import { createSkyLowlight } from '@skytech/content-render/highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { useState } from 'react';

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const language = (node.attrs as { language: string | null }).language ?? 'plaintext';
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(node.textContent).then(() => {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  };

  return (
    <NodeViewWrapper className="code-block" data-language={language}>
      <div className="code-block__header" contentEditable={false}>
        {editor.isEditable ? (
          <select
            value={language}
            onChange={(e) => {
              updateAttributes({ language: e.target.value });
            }}
            aria-label="Язык кода"
            className="code-block__lang cursor-pointer rounded-sm bg-transparent py-0.5 outline-none hover:bg-muted"
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="code-block__lang">{language}</span>
        )}
        <button type="button" className="code-block__copy" data-copied={copied} onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre spellCheck={false}>
        {/* @ts-expect-error -- NodeViewContent accepts `as`, its typing is narrower than the runtime */}
        <NodeViewContent as="code" className={`hljs language-${language}`} />
      </pre>
    </NodeViewWrapper>
  );
}

/** Same lowlight instance (same languages) as the server renderer — ADR 0002. */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({
  lowlight: createSkyLowlight(),
  defaultLanguage: 'plaintext',
  enableTabIndentation: true,
});
