import { marked } from "marked";
import type { Tokens } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens: TokensList = marked.lexer(markdown);
  return tokens.map((token: Tokens.Generic) => token.raw);
}

type TokensList = Array<Tokens.Generic & { raw: string }>;

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = ({ content, id }: { content: string; id: string }) => {
  // Parse content into blocks for better streaming visualization
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
  
  // For streaming, we want to show the last block immediately without memoization
  // so it updates as text streams in
  return (
    <>
      {blocks.slice(0, -1).map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
        <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
      ))}
      {blocks.length > 0 && (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {blocks[blocks.length - 1]}
          </ReactMarkdown>
        </div>
      )}
    </>
  );
};

MemoizedMarkdown.displayName = "MemoizedMarkdown";
