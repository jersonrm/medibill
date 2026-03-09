"use client";

import { useState } from "react";

interface FAQAccordionProps {
  items: { question: string; answer: string }[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
      {items.map((item, index) => (
        <div key={index}>
          <button
            onClick={() =>
              setOpenIndex(openIndex === index ? null : index)
            }
            className="flex w-full items-center justify-between px-6 py-5 text-left"
          >
            <span className="pr-4 text-sm font-semibold text-medi-deep">
              {item.question}
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-medi-primary transition-transform ${
                openIndex === index ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {openIndex === index && (
            <div className="px-6 pb-5">
              <p className="text-sm leading-relaxed text-gray-600">
                {item.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
