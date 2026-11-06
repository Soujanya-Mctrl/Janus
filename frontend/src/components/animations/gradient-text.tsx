"use client";

import React, { CSSProperties } from "react";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  style?: CSSProperties;
}

export function GradientText({
  children,
  className = "",
  colors = ["#ffffff", "#a1a1aa", "#ffffff", "#e4e4e7", "#ffffff"],
  animationSpeed = 6,
  showBorder = false,
  style = {},
}: GradientTextProps) {
  const gradientStyle: CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
  };

  return (
    <span
      className={`gradient-text-container ${showBorder ? "with-border" : ""} ${className}`}
      style={style}
    >
      {showBorder && (
        <span
          className="gradient-overlay"
          style={gradientStyle}
        />
      )}
      <span
        className="gradient-text-content"
        style={gradientStyle}
      >
        {children}
      </span>
    </span>
  );
}

