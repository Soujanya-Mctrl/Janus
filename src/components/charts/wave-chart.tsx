"use client";

import React, { useState } from "react";

interface WaveChartProps {
  className?: string;
  height?: number;
  interactive?: boolean;
}

export function WaveChart({ className = "", height = 90, interactive = true }: WaveChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Smooth wave points matching Whitmore Family Trust chart in video
  const points = [
    { x: 0, y: 70, val: "$17.9M", date: "Jan" },
    { x: 35, y: 76, val: "$17.8M", date: "Feb" },
    { x: 70, y: 64, val: "$18.1M", date: "Mar" },
    { x: 110, y: 68, val: "$18.0M", date: "Apr" },
    { x: 150, y: 45, val: "$18.5M", date: "May" },
    { x: 190, y: 55, val: "$18.3M", date: "Jun" },
    { x: 230, y: 35, val: "$18.8M", date: "Jul" },
    { x: 270, y: 48, val: "$18.42M", date: "Aug" },
  ];

  // SVG Catmull-Rom or cubic bezier path
  const pathD = "M 0 70 C 25 70, 45 76, 70 64 C 95 52, 120 72, 150 45 C 175 22, 205 60, 230 35 C 250 15, 260 48, 270 48";
  const areaD = `${pathD} L 270 95 L 0 95 Z`;

  return (
    <div className={`relative w-full overflow-visible ${className}`}>
      <svg
        viewBox="0 0 270 95"
        className="w-full h-auto overflow-visible"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
          </linearGradient>

          <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ffffff" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Shaded Area under the wave */}
        <path d={areaD} fill="url(#waveFill)" />

        {/* Main Wave Curve */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#waveStroke)"
          strokeWidth="1.8"
          strokeLinecap="round"
          filter="url(#waveGlow)"
        />

        {/* Interactive Hover Nodes */}
        {interactive &&
          points.map((pt, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIndex === idx ? 4.5 : 2}
                fill={hoveredIndex === idx ? "#ffffff" : "rgba(255,255,255,0.4)"}
                stroke="#0d0d11"
                strokeWidth="1.5"
                className="transition-all duration-200"
              />
            </g>
          ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="absolute -top-7 px-2 py-0.5 rounded bg-zinc-900 border border-white/20 text-[10px] font-mono text-white shadow-xl pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${(points[hoveredIndex].x / 270) * 100}%`,
          }}
        >
          {points[hoveredIndex].val} ({points[hoveredIndex].date})
        </div>
      )}
    </div>
  );
}

