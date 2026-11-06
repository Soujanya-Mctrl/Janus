"use client";

import React, { useState } from "react";

export function RadarChart({ className = "" }: { className?: string }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 6 radial axes: Jan, Feb, Mar, Apr, May, Jun (matching video f_07)
  const axes = [
    { label: "Jan", angle: 0, val: 218 },
    { label: "Feb", angle: 60, val: 140 },
    { label: "Mar", angle: 120, val: 185 },
    { label: "Apr", angle: 180, val: 74 },
    { label: "May", angle: 240, val: 160 },
    { label: "Jun", angle: 300, val: 35 },
  ];

  const center = 100;
  const radius = 68;

  // Concentric polygon web levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (angleInDegrees: number, r: number) => {
    // Start at top (-90 degrees)
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: center + r * Math.cos(angleInRadians),
      y: center + r * Math.sin(angleInRadians),
    };
  };

  // Generate polygon points for web rings
  const getRingPoints = (level: number) => {
    return axes
      .map((axis) => {
        const { x, y } = getCoordinates(axis.angle, radius * level);
        return `${x},${y}`;
      })
      .join(" ");
  };

  // Normalized active data polygon
  // Values: Jan 0.9, Feb 0.55, Mar 0.8, Apr 0.35, May 0.7, Jun 0.4
  const dataMultipliers = [0.92, 0.58, 0.82, 0.38, 0.72, 0.42];
  const dataPolygonPoints = axes
    .map((axis, i) => {
      const { x, y } = getCoordinates(axis.angle, radius * dataMultipliers[i]);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <svg viewBox="0 0 200 200" className="w-full max-w-[210px] h-auto overflow-visible">
        {/* Web Rings */}
        {levels.map((level, i) => (
          <polygon
            key={i}
            points={getRingPoints(level)}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="0.9"
          />
        ))}

        {/* Axis Lines */}
        {axes.map((axis, i) => {
          const outer = getCoordinates(axis.angle, radius);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Filled Data Polygon (Spiderweb overlay) */}
        <polygon
          points={dataPolygonPoints}
          fill="rgba(255, 255, 255, 0.12)"
          stroke="#ffffff"
          strokeWidth="1.6"
          className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
        />

        {/* Data Points on vertices */}
        {axes.map((axis, i) => {
          const pt = getCoordinates(axis.angle, radius * dataMultipliers[i]);
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={activeCategory === axis.label ? 4 : 2.5}
              fill="#ffffff"
              stroke="#111"
              strokeWidth="1"
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActiveCategory(axis.label)}
              onMouseLeave={() => setActiveCategory(null)}
            />
          );
        })}

        {/* Outer Axis Labels */}
        {axes.map((axis, i) => {
          const labelPt = getCoordinates(axis.angle, radius + 14);
          return (
            <text
              key={i}
              x={labelPt.x}
              y={labelPt.y + 3}
              textAnchor="middle"
              className="text-[9px] fill-zinc-400 font-mono tracking-wider uppercase select-none"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Numerical Badge in center/bottom */}
      <div className="absolute top-[48%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="text-[10px] font-mono text-zinc-400/80 bg-zinc-950/80 px-1 rounded">
          {activeCategory ? activeCategory : "INDEX"}
        </span>
      </div>
    </div>
  );
}

