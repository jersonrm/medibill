"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export function StatCounter({ value, label, prefix = "", suffix = "" }: StatCounterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-bold text-medi-deep md:text-4xl">
        {isVisible ? (
          <>
            {prefix}
            {value}
            {suffix}
          </>
        ) : (
          <span className="invisible">
            {prefix}
            {value}
            {suffix}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}
