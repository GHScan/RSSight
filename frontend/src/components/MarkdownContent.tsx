import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";

const proseClasses = {
  p: "text-foreground mb-3 last:mb-0 leading-relaxed",
  h1: "text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0 tracking-tight",
  h2: "text-xl font-semibold text-foreground mt-5 mb-2 border-b border-border pb-1",
  h3: "text-lg font-semibold text-foreground mt-4 mb-1",
  h4: "text-base font-semibold text-foreground mt-3 mb-1",
  ul: "list-disc list-outside pl-6 mb-3 space-y-1 text-foreground",
  ol: "list-decimal list-outside pl-6 mb-3 space-y-1 text-foreground",
  li: "text-foreground leading-relaxed pl-1",
  blockquote: "border-l-4 border-primary/60 bg-muted/30 pl-4 py-1 my-3 text-muted-foreground italic rounded-r",
  code: "bg-muted text-foreground px-1.5 py-0.5 rounded text-sm font-mono border border-border/50",
  pre: "bg-muted rounded-lg p-4 overflow-x-auto my-3 text-sm border border-border/50",
  a: "text-primary hover:underline font-medium",
  strong: "font-semibold text-foreground",
  em: "italic",
  hr: "border-t border-border my-4",
  del: "line-through text-muted-foreground",
  table: "w-full border-collapse text-sm min-w-[200px] table-auto",
  thead: "bg-muted",
  th: "text-left font-semibold text-foreground px-4 py-2.5 border border-border",
  tbody: "",
  tr: "hover:bg-muted/30 transition-colors",
  td: "px-4 py-2.5 text-foreground border border-border",
};

function CopyButton({
  text,
  getText,
  className = "",
}: {
  text?: string;
  getText?: () => string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const toCopy = getText ? getText() : text ?? "";
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`absolute top-2 right-2 inline-flex items-center justify-center min-h-[36px] min-w-[72px] rounded-md px-3 py-1.5 text-sm font-medium bg-background/80 text-foreground border border-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      title="复制"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

let mermaidInitialized = false;
function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false });
    mermaidInitialized = true;
  }
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;
    ensureMermaidInit();
    let cancelled = false;
    setError(null);
    mermaid
      .run({
        nodes: [containerRef.current],
        suppressErrors: false,
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Mermaid render failed");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className={proseClasses.pre}>
        <code>{code}</code>
        <p className="text-destructive text-xs mt-2">{error}</p>
      </pre>
    );
  }

  return (
    <div ref={containerRef} className="mermaid my-4 flex justify-center [&_svg]:max-w-full">
      {code}
    </div>
  );
}

function BlockquoteWithCopy({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLQuoteElement>(null);
  return (
    <div className="relative my-3 group">
      <CopyButton getText={() => ref.current?.innerText?.trim() ?? ""} />
      <blockquote ref={ref} className={proseClasses.blockquote}>
        {children}
      </blockquote>
    </div>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm text-foreground [&_.katex]:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className={proseClasses.p}>{children}</p>,
          h1: ({ children }) => <h1 className={proseClasses.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={proseClasses.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={proseClasses.h3}>{children}</h3>,
          h4: ({ children }) => <h4 className={proseClasses.h4}>{children}</h4>,
          ul: ({ children }) => <ul className={proseClasses.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={proseClasses.ol}>{children}</ol>,
          li: ({ children }) => <li className={proseClasses.li}>{children}</li>,
          blockquote: ({ children }) => <BlockquoteWithCopy>{children}</BlockquoteWithCopy>,
          strong: ({ children }) => <strong className={proseClasses.strong}>{children}</strong>,
          em: ({ children }) => <em className={proseClasses.em}>{children}</em>,
          hr: () => <hr className={proseClasses.hr} />,
          del: ({ children }) => <del className={proseClasses.del}>{children}</del>,
          table: ({ children, className, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table {...props} className={`${proseClasses.table} ${className ?? ""}`.trim()}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, className, ...props }) => (
            <thead {...props} className={`${proseClasses.thead} ${className ?? ""}`.trim()}>
              {children}
            </thead>
          ),
          tbody: ({ children, className, ...props }) => (
            <tbody {...props} className={`${proseClasses.tbody} ${className ?? ""}`.trim()}>
              {children}
            </tbody>
          ),
          tr: ({ children, className, ...props }) => (
            <tr {...props} className={`${proseClasses.tr} ${className ?? ""}`.trim()}>
              {children}
            </tr>
          ),
          th: ({ children, className, ...props }) => (
            <th {...props} className={`${proseClasses.th} ${className ?? ""}`.trim()}>
              {children}
            </th>
          ),
          td: ({ children, className, ...props }) => (
            <td {...props} className={`${proseClasses.td} ${className ?? ""}`.trim()}>
              {children}
            </td>
          ),
          code: ({ className, children }) => {
            const lang = className?.replace("language-", "").trim().toLowerCase();
            const code = String(children ?? "").replace(/\n$/, "");
            if (lang === "mermaid") {
              return <MermaidDiagram code={code} />;
            }
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <div className="relative my-3 rounded-lg overflow-hidden border border-border/50 [&>pre]:!mt-0 [&>pre]:!rounded-lg">
                  <CopyButton text={code} />
                  <SyntaxHighlighter
                    language={lang || "text"}
                    style={oneDark}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: 0, paddingTop: "2.25rem", paddingRight: "2.5rem" }}
                    codeTagProps={{ style: { fontSize: "0.875rem" } }}
                    showLineNumbers={code.split("\n").length > 4}
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code className={proseClasses.code}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a href={href} className={proseClasses.a} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
