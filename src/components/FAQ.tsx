'use client'

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: React.ReactNode
}

interface FAQProps {
  items: FAQItem[]
  theme?: 'dark' | 'light'
}

export default function FAQ({ items, theme = 'dark' }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const isDark = theme === 'dark'

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = openIndex === index
        const panelId = `faq-panel-${index}`
        const buttonId = `faq-button-${index}`

        return (
          <div
            key={index}
            className={`border-b ${isDark ? 'border-white/[0.08]' : 'border-[rgba(25,26,46,0.09)]'}`}
          >
            <button
              id={buttonId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(index)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span
                className={`font-display text-[0.9375rem] font-bold tracking-tight sm:text-base ${
                  isDark ? 'text-white' : 'text-[#191A2E]'
                }`}
              >
                {item.question}
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke={isDark ? '#BAF14D' : '#191A2E'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden" style={{ minHeight: 0 }}>
                <div
                  className={`pb-5 text-[0.9375rem] leading-[1.65] ${
                    isDark ? 'text-white/80' : 'text-[#4A4D68]'
                  }`}
                >
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
