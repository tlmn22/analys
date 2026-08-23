"use client";

// Same FIBA half-court geometry as ../../half-court-diagram.tsx (used for
// tagging shot locations), but rotated 90° into landscape — rim on the
// left, extending right to half-court — matching the reference tool's shot
// chart layout. shot_x/shot_y are stored normalized (0-1) in the TAGGING
// diagram's vertical orientation (0,0 = baseline/rim corner), so plotting
// here maps display_x = shot_y, display_y = shot_x.

import { useRef, useState, type MouseEvent } from "react";

export interface ChartDot {
  key: string;
  x: number; // normalized shot_x from tagging (0-1)
  y: number; // normalized shot_y from tagging (0-1)
  color: string;
  radius: number;
  onClick?: () => void;
}

/** A drag-selected rectangular region of the court, in normalized shot_x/
 * shot_y bounds (same coordinate space as ChartDot.x/y). */
export interface AreaSelection {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const WIDTH = 470;
const HEIGHT = 500;
// Below this many viewBox units of drag, treat it as a click (clear the
// selection) rather than an intentional rectangle.
const DRAG_THRESHOLD = 6;

export function ShotCourtChart({
  dots,
  selection,
  onSelectionChange,
}: {
  dots: ChartDot[];
  /** Current selection, drawn as an overlay rectangle. Omit (with
   * onSelectionChange) to disable area selection entirely. */
  selection?: AreaSelection | null;
  /** Called with the new selection on drag-end, or null when the user
   * clicks without dragging (clearing any existing selection). */
  onSelectionChange?: (sel: AreaSelection | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  function svgPoint(e: MouseEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function handleMouseDown(e: MouseEvent<SVGSVGElement>) {
    if (!onSelectionChange) return;
    if ((e.target as SVGElement).tagName === "circle") return; // let dot clicks through
    const p = svgPoint(e);
    setDrag({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!drag) return;
    const p = svgPoint(e);
    setDrag((d) => (d ? { ...d, curX: p.x, curY: p.y } : d));
  }

  function finishDrag() {
    if (!drag || !onSelectionChange) {
      setDrag(null);
      return;
    }
    const dx = Math.abs(drag.curX - drag.startX);
    const dy = Math.abs(drag.curY - drag.startY);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      onSelectionChange(null);
    } else {
      const pxMin = Math.min(drag.startX, drag.curX);
      const pxMax = Math.max(drag.startX, drag.curX);
      const pyMin = Math.min(drag.startY, drag.curY);
      const pyMax = Math.max(drag.startY, drag.curY);
      // Screen X is shot_y, screen Y is shot_x (see rotation note above).
      onSelectionChange({
        yMin: pxMin / WIDTH,
        yMax: pxMax / WIDTH,
        xMin: pyMin / HEIGHT,
        xMax: pyMax / HEIGHT,
      });
    }
    setDrag(null);
  }

  const overlayRect = drag
    ? {
        x: Math.min(drag.startX, drag.curX),
        y: Math.min(drag.startY, drag.curY),
        width: Math.abs(drag.curX - drag.startX),
        height: Math.abs(drag.curY - drag.startY),
      }
    : selection
      ? {
          x: selection.yMin * WIDTH,
          y: selection.xMin * HEIGHT,
          width: (selection.yMax - selection.yMin) * WIDTH,
          height: (selection.xMax - selection.xMin) * HEIGHT,
        }
      : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`w-full rounded-md border border-border bg-white ${onSelectionChange ? "cursor-crosshair" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDrag}
      onMouseLeave={() => drag && finishDrag()}
    >
      {/* boundary */}
      <rect x="2" y="2" width="466" height="496" fill="none" stroke="#333" strokeWidth="2" />
      {/* key / lane */}
      <rect x="2" y="170" width="188" height="160" fill="none" stroke="#333" strokeWidth="2" />
      {/* free-throw circle */}
      <circle cx="190" cy="250" r="60" fill="none" stroke="#333" strokeWidth="2" />
      {/* backboard */}
      <line x1="40" y1="215" x2="40" y2="285" stroke="#333" strokeWidth="3" />
      {/* rim */}
      <circle cx="52" cy="250" r="9" fill="none" stroke="#333" strokeWidth="2" />
      {/* restricted area */}
      <path d="M 52 210 A 40 40 0 0 1 52 290" fill="none" stroke="#333" strokeWidth="2" />
      {/* three point line: corners + arc */}
      <line x1="2" y1="30" x2="140" y2="30" stroke="#333" strokeWidth="2" />
      <line x1="2" y1="470" x2="140" y2="470" stroke="#333" strokeWidth="2" />
      <path d="M 140 30 A 230 230 0 0 1 140 470" fill="none" stroke="#333" strokeWidth="2" />
      {/* half-court line + a sliver of the center circle */}
      <line x1="466" y1="2" x2="466" y2="498" stroke="#333" strokeWidth="2" />
      <path d="M 466 195 A 55 55 0 0 0 466 305" fill="none" stroke="#333" strokeWidth="2" />

      {overlayRect && (
        <rect
          x={overlayRect.x}
          y={overlayRect.y}
          width={overlayRect.width}
          height={overlayRect.height}
          fill="#2563eb22"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}

      {dots.map((d) => (
        <circle
          key={d.key}
          cx={d.y * WIDTH}
          cy={d.x * HEIGHT}
          r={d.radius}
          fill={d.color}
          stroke="#00000055"
          strokeWidth={0.75}
          onClick={d.onClick}
          className={d.onClick ? "cursor-pointer" : undefined}
        />
      ))}
    </svg>
  );
}
