interface StepCardProps {
  step: number;
  title: string;
  description: string;
}

export function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-medi-primary text-lg font-bold text-white">
        {step}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-medi-deep">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}
