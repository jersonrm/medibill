"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-medi-primary hover:bg-medi-deep text-white font-black shadow-xl shadow-medi-primary/30",
  secondary:
    "bg-medi-light/40 hover:bg-medi-light text-medi-dark font-bold",
  danger:
    "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white shadow-sm",
  ghost:
    "text-medi-primary border-2 border-medi-light hover:bg-medi-light/50 font-bold",
};

const sizeStyles: Record<string, string> = {
  sm: "px-4 py-2 text-xs rounded-xl",
  md: "px-6 py-4 text-lg rounded-xl",
  lg: "py-5 text-xl rounded-2xl",
};

export const Button = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={`transition-all active:scale-[0.98] disabled:opacity-70 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
