import { type JSX, type ReactNode } from "react";

interface CardProps {
  className?: string;
  title?: string;
  children: ReactNode;
  variant?: "default" | "dark" | "accent";
}

const variantStyles: Record<string, string> = {
  default: "bg-white border border-medi-light/50 shadow-md",
  dark: "bg-medi-deep text-white shadow-xl border-t-4 border-medi-accent",
  accent: "bg-white border border-medi-light/50 shadow-lg",
};

export function Card({
  className = "",
  title,
  children,
  variant = "default",
}: CardProps): JSX.Element {
  return (
    <div className={`rounded-3xl overflow-hidden ${variantStyles[variant]} ${className}`}>
      {title && (
        <div
          className={`px-8 py-5 font-bold text-lg uppercase tracking-wider ${
            variant === "dark" ? "text-white" : "text-medi-deep"
          }`}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
