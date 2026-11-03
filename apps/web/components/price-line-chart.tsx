"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { formatDateTime, formatPriceCents, formatShortDate } from "@/lib/i18n";
import type { AppLocale } from "@/lib/i18n/locales";
import {
  getSparklineGeometry,
  type PriceDirection,
  type PricePoint,
  summarizePriceSeries,
} from "@price-monitor/shared/price-history";

export const DIRECTION_CLASS: Record<PriceDirection, string> = {
  down: "text-emerald-600 dark:text-emerald-400",
  up: "text-rose-600 dark:text-rose-400",
  flat: "text-[var(--muted)]",
};

export function formatChangePercent(percent: number | null, locale: AppLocale): string | null {
  if (percent == null) {
    return null;
  }
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(percent / 100);
}

export function formatChangeCents(cents: number, locale: AppLocale): string {
  const formatted = formatPriceCents(Math.abs(cents), locale);
  return cents < 0 ? `−${formatted}` : cents > 0 ? `+${formatted}` : formatted;
}

const CHART_MARGIN = { left: 76, right: 14, top: 14, bottom: 30 };
const DEFAULT_CHART_WIDTH = 600;
const NARROW_CHART_WIDTH = 480;
/** Above this many points, only the active and latest points get markers. */
const MAX_POINT_MARKERS = 120;

/**
 * Chart size in CSS pixels, matched to its container so axis text stays 12px on every screen
 * (a fixed viewBox would shrink the labels on phones).
 */
function useChartWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

interface PriceLineChartProps {
  /** At least 2 points, oldest first. */
  points: PricePoint[];
  /** Accessible name of the chart. */
  label: string;
}

/**
 * Interactive time-scaled price chart: hover, tap, or arrow keys select a point, whose date and
 * price are announced in the readout line above the chart.
 */
export function PriceLineChart({ points, label }: PriceLineChartProps) {
  const locale = useLocale();
  const t = useTranslations();
  const summary = summarizePriceSeries(points);
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWidth = useChartWidth(containerRef);
  const chart = {
    ...CHART_MARGIN,
    width: chartWidth,
    height: chartWidth < NARROW_CHART_WIDTH ? 200 : 240,
  };

  if (!summary) {
    return null;
  }

  const plot = {
    width: chart.width - chart.left - chart.right,
    height: chart.height - chart.top - chart.bottom,
    padding: 6,
  };
  const { path, coordinates } = getSparklineGeometry(points, plot, { xScale: "time" });
  const active = points[activeIndex] ?? summary.latest;
  const activeCoordinate = coordinates[activeIndex] ?? coordinates[coordinates.length - 1];
  const yTop = chart.top + plot.padding;
  const yBottom = chart.top + plot.height - plot.padding;
  const showMarkers = points.length <= MAX_POINT_MARKERS;

  function selectNearest(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((clientX - rect.left) / rect.width) * chart.width - chart.left;
    let nearest = 0;
    coordinates.forEach((coordinate, index) => {
      if (Math.abs(coordinate.x - x) < Math.abs(coordinates[nearest].x - x)) nearest = index;
    });
    setActiveIndex(nearest);
  }

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    selectNearest(event.clientX);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: activeIndex - 1,
      ArrowDown: activeIndex - 1,
      ArrowRight: activeIndex + 1,
      ArrowUp: activeIndex + 1,
      Home: 0,
      End: points.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(Math.min(points.length - 1, Math.max(0, moves[event.key])));
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium tabular-nums" aria-live="polite">
          {t("priceHistoryPointReadout", {
            date: formatDateTime(active.observedAt, locale),
            price: formatPriceCents(active.priceCents, locale),
          })}
        </p>
        <p className="text-xs text-[var(--muted)]">{t("priceHistoryChartHint")}</p>
      </div>

      <div ref={containerRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className={`w-full touch-none select-none rounded-md focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${DIRECTION_CLASS[summary.direction]}`}
          role="group"
          aria-label={label}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onKeyDown={handleKeyDown}
        >
          <g className="text-[var(--muted)]" fill="currentColor" fontSize={12}>
            <line x1={chart.left} x2={chart.width - chart.right} y1={yTop} y2={yTop} stroke="var(--border)" />
            <line x1={chart.left} x2={chart.width - chart.right} y1={yBottom} y2={yBottom} stroke="var(--border)" />
            <text x={chart.left - 8} y={yTop + 4} textAnchor="end">
              {formatPriceCents(summary.highest.priceCents, locale)}
            </text>
            <text x={chart.left - 8} y={yBottom + 4} textAnchor="end">
              {formatPriceCents(summary.lowest.priceCents, locale)}
            </text>
            <text x={chart.left + plot.padding} y={chart.height - 8} textAnchor="start">
              {formatShortDate(summary.first.observedAt, locale)}
            </text>
            <text x={chart.width - chart.right - plot.padding} y={chart.height - 8} textAnchor="end">
              {formatShortDate(summary.latest.observedAt, locale)}
            </text>
          </g>
          <g transform={`translate(${chart.left} ${chart.top})`}>
            <line
              x1={activeCoordinate.x}
              x2={activeCoordinate.x}
              y1={plot.padding}
              y2={plot.height - plot.padding}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {showMarkers
              ? coordinates.map((coordinate, index) => (
                  <circle key={index} cx={coordinate.x} cy={coordinate.y} r={3} fill="currentColor" />
                ))
              : null}
            <circle
              cx={coordinates[coordinates.length - 1].x}
              cy={coordinates[coordinates.length - 1].y}
              r={5}
              fill="currentColor"
            />
            <circle
              cx={activeCoordinate.x}
              cy={activeCoordinate.y}
              r={6.5}
              fill="var(--card)"
              stroke="currentColor"
              strokeWidth={3}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
