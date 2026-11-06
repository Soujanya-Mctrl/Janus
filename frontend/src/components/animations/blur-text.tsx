"use client";

import React, { useEffect, useRef, useState, CSSProperties } from "react";

interface BlurTextProps {
  text: string;
  delay?: number; // ms per word/char
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  style?: CSSProperties;
}

export function BlurText({
  text,
  delay = 40,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.15,
  style = {},
}: BlurTextProps) {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const elements = animateBy === "words" ? text.split(" ") : text.split("");

  return (
    <span ref={containerRef} className={`blur-text-wrapper ${className}`} style={{ textAlign: "inherit", ...style }}>
      {elements.map((segment, index) => {
        const offset = direction === "top" ? "-8px" : "8px";
        const delayMs = index * delay;

        return (
          <span
            key={index}
            className="blur-text-segment inline-block"
            style={{
              filter: inView ? "blur(0px)" : "blur(10px)",
              opacity: inView ? 1 : 0,
              transform: inView ? "translate3d(0, 0, 0)" : `translate3d(0, ${offset}, 0)`,
              transition: `all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms`,
              marginRight: animateBy === "words" ? "0.28em" : "0",
            }}
          >
            {segment === " " ? "\u00A0" : segment}
          </span>
        );
      })}
    </span>
  );
}
