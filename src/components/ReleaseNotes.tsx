import { ReactNode } from 'react';

interface ReleaseNotesProps {
  body: string;
  compact?: boolean;
}

export function ReleaseNotes({ body, compact = false }: ReleaseNotesProps) {
  const trimmed = body.trim();

  if (!trimmed) {
    return (
      <p className="text-sm text-slate-400">
        لا توجد ملاحظات تغيير مرفقة لهذا الإصدار.
      </p>
    );
  }

  const lines = trimmed.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`list-${keyPrefix}`}
        className="space-y-1.5 pr-4 list-disc text-slate-300 text-sm sm:text-[15px] leading-relaxed"
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(`empty-${index}`);
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
        <h4
          key={`h-${index}`}
          className="font-display text-sm sm:text-base font-bold text-sky-300 pt-1"
        >
          {headingMatch[1]}
        </h4>
      );
      return;
    }

    blocks.push(
      <p
        key={`p-${index}`}
        className="text-sm sm:text-[15px] text-slate-300 leading-relaxed"
      >
        {line}
      </p>
    );
  });

  flushList('end');

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'} dir="auto">
      {blocks}
    </div>
  );
}
