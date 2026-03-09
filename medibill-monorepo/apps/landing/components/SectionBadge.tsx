interface SectionBadgeProps {
  emoji: string;
  text: string;
}

export function SectionBadge({ emoji, text }: SectionBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-medi-light bg-medi-light/20 px-4 py-1.5 text-sm font-medium text-medi-primary">
      <span>{emoji}</span>
      {text}
    </span>
  );
}
