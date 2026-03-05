import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";

const proseClasses = {
  p: "text-foreground mb-3 last:mb-0",
  h1: "text-xl font-semibold text-foreground mt-4 mb-2 first:mt-0",
  h2: "text-lg font-semibold text-foreground mt-4 mb-2",
  h3: "text-base font-semibold text-foreground mt-3 mb-1",
  ul: "list-disc list-inside mb-3 space-y-1 text-foreground",
  ol: "list-decimal list-inside mb-3 space-y-1 text-foreground",
  li: "text-foreground",
  blockquote: "border-l-4 border-border pl-4 my-3 text-muted-foreground italic",
  code: "bg-secondary/50 text-foreground px-1.5 py-0.5 rounded text-sm font-mono",
  pre: "bg-secondary/50 rounded-md p-4 overflow-x-auto my-3 text-sm",
  a: "text-primary hover:underline",
};

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

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm text-foreground [&_.katex]:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className={proseClasses.p}>{children}</p>,
          h1: ({ children }) => <h1 className={proseClasses.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={proseClasses.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={proseClasses.h3}>{children}</h3>,
          ul: ({ children }) => <ul className={proseClasses.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={proseClasses.ol}>{children}</ol>,
          li: ({ children }) => <li className={proseClasses.li}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={proseClasses.blockquote}>{children}</blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const lang = className?.replace("language-", "").trim().toLowerCase();
            const code = String(children ?? "").replace(/\n$/, "");
            if (lang === "mermaid") {
              return <MermaidDiagram code={code} />;
            }
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre className={proseClasses.pre} {...props}>
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className={proseClasses.code} {...props}>
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
