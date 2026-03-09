interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.medibill.co";

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  ctaLabel = "Comenzar Gratis",
  ctaHref,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? "border-medi-primary bg-white shadow-lg ring-1 ring-medi-primary/20"
          : "border-gray-100 bg-white shadow-sm"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-medi-primary px-4 py-1 text-xs font-semibold text-white">
          Más popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-medi-dark">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-medi-deep">{price}</span>
        <span className="text-sm text-gray-500">{period}</span>
      </div>
      <p className="mt-3 text-sm text-gray-600">{description}</p>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-medi-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref || `${APP_URL}/login`}
        className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
          highlighted
            ? "bg-medi-primary text-white hover:bg-medi-accent"
            : "border border-medi-primary text-medi-primary hover:bg-medi-primary hover:text-white"
        }`}
      >
        {ctaLabel}
      </a>
    </div>
  );
}
