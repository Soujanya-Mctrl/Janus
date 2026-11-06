"use client";

import React, { CSSProperties } from "react";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number; // seconds
  className?: string;
  style?: CSSProperties;
}

export function ShinyText({
  text,
  disabled = false,
  speed = 5,
  className = "",
  style = {},
}: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`shiny-text ${disabled ? "disabled" : ""} ${className}`}
      style={{ ...style, animationDuration }}
    >
      {text}
    </span>
  );
}

