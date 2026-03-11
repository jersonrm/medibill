interface SectionBadgeProps {
  text: string;
  emoji?: string;
}

export function SectionBadge({ text, emoji }: SectionBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-medi-light bg-medi-light/20 px-4 py-1.5 text-sm font-medium text-medi-primary">
      {emoji && <span className="mr-1.5">{emoji}</span>}
      {text}
    </span>
  );
}
