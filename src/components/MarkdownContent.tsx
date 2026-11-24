import { ReactNode } from 'react';

interface MarkdownContentProps {
  content: string;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2];
      const href = match[3].trim();
      if (isSafeHttpUrl(href)) {
        tokens.push(
          <a
            key={`${keyPrefix}-link-${partIdx++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline decoration-sky-400/50 hover:text-white transition-colors"
          >
            {label}
          </a>
        );
      } else {
        tokens.push(label);
      }
    } else if (match[4] !== undefined) {
      tokens.push(
        <code
          key={`${keyPrefix}-code-${partIdx++}`}
          dir="ltr"
          className="font-mono-tabular text-xs sm:text-[13px] px-1.5 py-0.5 rounded bg-[#030917] border border-sky-400/20 text-sky-200"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] !== undefined) {
      tokens.push(
        <strong
          key={`${keyPrefix}-b-${partIdx++}`}
          className="font-bold text-white"
        >
          {match[5]}
        </strong>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`list-${keyPrefix}`}
        className="space-y-1.5 pr-5 list-disc text-slate-300 text-sm sm:text-[15px] leading-relaxed"
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineMarkdown(item, `${keyPrefix}-li-${idx}`)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushCode = (keyPrefix: string) => {
    if (codeLines.length === 0) return;
    blocks.push(
      <pre
        key={`pre-${keyPrefix}`}
        dir="ltr"
        className="overflow-x-auto rounded-xl bg-[#030917] border border-sky-400/20 p-3.5 text-xs sm:text-[13px] text-sky-200 font-mono-tabular leading-relaxed"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
    codeLines = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (/^(```|~~~)/.test(line)) {
      if (inCodeBlock) {
        flushCode(`end-${index}`);
        inCodeBlock = false;
      } else {
        flushList(`code-start-${index}`);
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!line) {
      flushList(`empty-${index}`);
      return;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushList(`hr-${index}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (bulletMatch || numberedMatch) {
      listItems.push((bulletMatch?.[1] || numberedMatch?.[1] || '').trim());
      return;
    }

    flushList(`line-${index}`);

    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <h3
          key={`h-${index}`}
          className="font-display text-sm sm:text-base font-bold text-sky-300 pt-1.5"
        >
          {renderInlineMarkdown(headingMatch[1], `h-${index}`)}
        </h3>
      );
      return;
    }

    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '').trim();
      if (quoteText) {
        blocks.push(
          <blockquote
            key={`q-${index}`}
            className="rounded-lg bg-[#051026] border border-sky-400/20 px-4 py-2.5 text-sm text-sky-100 leading-relaxed"
          >
            {renderInlineMarkdown(quoteText, `q-${index}`)}
          </blockquote>
        );
      }
      return;
    }

    blocks.push(
      <p
        key={`p-${index}`}
        className="text-sm sm:text-[15px] text-slate-300 leading-relaxed"
      >
        {renderInlineMarkdown(line, `p-${index}`)}
      </p>
    );
  });

  flushCode('eof');
  flushList('eof');

  return (
    <div className="space-y-3" dir="auto">
      {blocks}
    </div>
  );
}
