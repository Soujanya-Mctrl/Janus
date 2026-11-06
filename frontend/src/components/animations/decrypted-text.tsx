"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  revealDirection?: "start" | "end" | "center";
  animateOn?: "view" | "hover";
  [key: string]: unknown;
}

export function DecryptedText({
  text,
  speed = 45,
  maxIterations = 12,
  characters = "0123456789ABCDEFabcdef!@#$%^&*()_+~<>:{}",
  className = "",
  encryptedClassName = "",
  revealDirection = "start",
  animateOn = "view",
  ...props
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState<string>(text);
  const containerRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    let currentIteration = 0;

    intervalRef.current = setInterval(() => {
      setDisplayText(() =>
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";

            let revealCondition = false;
            if (revealDirection === "start") {
              revealCondition = index / text.length < currentIteration / maxIterations;
            } else if (revealDirection === "end") {
              revealCondition = index / text.length > 1 - currentIteration / maxIterations;
            } else if (revealDirection === "center") {
              const center = text.length / 2;
              revealCondition = Math.abs(index - center) / center > 1 - currentIteration / maxIterations;
            }

            if (revealCondition || currentIteration >= maxIterations) {
              return text[index];
            }

            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
      );

      if (currentIteration >= maxIterations) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      currentIteration++;
    }, speed);
  }, [text, speed, maxIterations, characters, revealDirection]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (animateOn !== "view") return;

    let hasAnimated = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          hasAnimated = true;
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [animateOn, startAnimation]);

  const handleMouseEnter = () => {
    if (animateOn === "hover") {
      startAnimation();
    }
  };

  const handleMouseLeave = () => {
    if (animateOn === "hover") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayText(text);
    }
  };

  return (
    <span
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {displayText.split("").map((char, index) => {
        const isOriginal = text[index] === char;
        return (
          <span
            key={index}
            className={!isOriginal && encryptedClassName ? encryptedClassName : ""}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
