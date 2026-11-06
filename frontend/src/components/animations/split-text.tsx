"use client";

import React, { CSSProperties } from "react";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number; // ms delay per word/char
  duration?: number; // ms duration
  splitBy?: "words" | "chars";
  style?: CSSProperties;
}

export function SplitText({
  text,
  className = "",
  delay = 35,
  splitBy = "words",
  style = {},
}: SplitTextProps) {
  if (splitBy === "chars") {
    const chars = text.split("");
    return (
      <span className={`inline-block ${className}`} style={style}>
        {chars.map((char, index) => (
          <span
            key={index}
            className="split-char-anim inline-block"
            style={
              {
                "--char-index": index,
                animationDelay: `${index * delay}ms`,
              } as CSSProperties
            }
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    );
  }

  const words = text.split(" ");
  return (
    <span className={`inline-block ${className}`} style={style}>
      {words.map((word, index) => (
        <span
          key={index}
          className="split-word-anim inline-block mr-[0.25em]"
          style={
            {
              "--word-index": index,
              animationDelay: `${index * delay}ms`,
            } as CSSProperties
          }
        >
          {word}
        </span>
      ))}
    </span>
  );
}

