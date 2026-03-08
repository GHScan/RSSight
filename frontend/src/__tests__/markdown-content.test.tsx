import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../components/MarkdownContent";

describe("MarkdownContent", () => {
  it("renders blockquote with proper line breaks", () => {
    const markdown = `# Test Header

> Line 1
> Line 2
> Line 3

Normal paragraph.`;

    const { container } = render(<MarkdownContent content={markdown} />);

    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeInTheDocument();

    // Check that the blockquote contains the expected text with line breaks
    const blockquoteText = blockquote!.textContent;
    expect(blockquoteText).toContain("Line 1");
    expect(blockquoteText).toContain("Line 2");
    expect(blockquoteText).toContain("Line 3");

    // Check that whitespace is preserved
    expect(blockquoteText).toMatch(/Line 1\s+Line 2\s+Line 3/);
  });

  it("renders blockquote with directory listing", () => {
    const markdown = `# Directory Structure

> docs/
> scripts/
> backend/
> frontend/

This is a normal paragraph.`;

    const { container } = render(<MarkdownContent content={markdown} />);

    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeInTheDocument();

    // The blockquote should contain the directory listing
    const blockquoteText = blockquote!.textContent;
    expect(blockquoteText).toContain("docs/");
    expect(blockquoteText).toContain("scripts/");
    expect(blockquoteText).toContain("backend/");
    expect(blockquoteText).toContain("frontend/");

    // Check that line breaks are preserved
    expect(blockquoteText).toMatch(/docs\/\s+scripts\/\s+backend\/\s+frontend\//);
  });

  it("renders unlabeled fenced code blocks as multi-line block content", () => {
    const markdown = `* **硬核细节**：
  代码仓库知识存储结构：
  \`\`\`
  AGENTS.md
  ARCHITECTURE.md
  docs/
  ├── design-docs/
  │   ├── index.md
  │   └── ...
  \`\`\``;

    const { container } = render(<MarkdownContent content={markdown} />);
    const inlineCode = container.querySelector("code.bg-muted.text-foreground");
    expect(inlineCode).toBeNull();

    const renderedBlockText = container.textContent ?? "";
    expect(renderedBlockText).toContain("AGENTS.md");
    expect(renderedBlockText).toContain("ARCHITECTURE.md");
    expect(renderedBlockText).toContain("docs/");
    expect(renderedBlockText).toContain("design-docs/");
  });
});