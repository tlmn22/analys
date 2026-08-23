"use client";

import { useRef } from "react";

/** Stylized FIBA half-court, baseline at top. Click reports a normalized
 * (0-1, 0-1) x/y position relative to the diagram's bounding box. */
export function HalfCourtDiagram({
  onPick,
}: {
  onPick: (x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPick(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 470"
      onClick={handleClick}
      className="w-full cursor-crosshair rounded-md border border-border bg-white"
    >
      {/* boundary */}
      <rect x="2" y="2" width="496" height="466" fill="none" stroke="#333" strokeWidth="2" />
      {/* baseline already covered by rect top edge */}
      {/* key / lane */}
      <rect x="170" y="2" width="160" height="188" fill="none" stroke="#333" strokeWidth="2" />
      {/* free-throw circle */}
      <circle cx="250" cy="190" r="60" fill="none" stroke="#333" strokeWidth="2" />
      {/* backboard */}
      <line x1="215" y1="40" x2="285" y2="40" stroke="#333" strokeWidth="3" />
      {/* rim */}
      <circle cx="250" cy="52" r="9" fill="none" stroke="#333" strokeWidth="2" />
      {/* restricted area */}
      <path d="M 210 52 A 40 40 0 0 0 290 52" fill="none" stroke="#333" strokeWidth="2" />
      {/* three point line: corners + arc */}
      <line x1="30" y1="2" x2="30" y2="140" stroke="#333" strokeWidth="2" />
      <line x1="470" y1="2" x2="470" y2="140" stroke="#333" strokeWidth="2" />
      <path
        d="M 30 140 A 230 230 0 0 0 470 140"
        fill="none"
        stroke="#333"
        strokeWidth="2"
      />
      {/* half-court line at the bottom edge */}
      <line x1="2" y1="466" x2="498" y2="466" stroke="#333" strokeWidth="2" />
    </svg>
  );
}
