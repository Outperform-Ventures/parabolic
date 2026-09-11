import React, { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, type HSV } from "./color-model";
export function ColorSpectrum({
  color,
  onPreview,
  onChange,
}: {
  color: string;
  onPreview: (color: string) => void;
  onChange: (color: string) => void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(color)),
    current = useRef(hsv),
    dragging = useRef(false),
    before = useRef(hsv),
    plane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dragging.current || !/^#[0-9a-f]{6}$/i.test(color)) return;
    const next = hexToHsv(color);
    if (next.s === 0 || next.v === 0) next.h = current.current.h;
    current.current = next;
    setHsv(next);
  }, [color]);
  const update = (value: HSV) => {
    current.current = value;
    setHsv(value);
    onPreview(hsvToHex(value));
  };
  const point = (event: React.PointerEvent) => {
    const rect = plane.current!.getBoundingClientRect();
    update({
      ...current.current,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
  };
  const commit = () => onChange(hsvToHex(current.current));
  return (
    <div className="entity-color-spectrum">
      <div
        ref={plane}
        className="entity-color-plane"
        tabIndex={0}
        role="slider"
        aria-label="Color saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          before.current = current.current;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          point(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) point(event);
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          point(event);
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          commit();
        }}
        onPointerCancel={() => {
          dragging.current = false;
          update(before.current);
        }}
        onKeyDown={(event) => {
          if (
            !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          const step = event.shiftKey ? 0.1 : 0.01;
          update({
            ...current.current,
            s: Math.max(
              0,
              Math.min(
                1,
                current.current.s +
                  (event.key === "ArrowRight"
                    ? step
                    : event.key === "ArrowLeft"
                      ? -step
                      : 0),
              ),
            ),
            v: Math.max(
              0,
              Math.min(
                1,
                current.current.v +
                  (event.key === "ArrowUp"
                    ? step
                    : event.key === "ArrowDown"
                      ? -step
                      : 0),
              ),
            ),
          });
          commit();
        }}
      >
        <span
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: hsvToHex(hsv),
          }}
        />
      </div>
      <input
        type="range"
        min="0"
        max="359"
        step="1"
        className="entity-color-hue"
        aria-label="Color hue"
        aria-valuetext={`${Math.round(hsv.h)} degrees`}
        value={Math.round(hsv.h)}
        onChange={(event) =>
          update({ ...current.current, h: Number(event.target.value) })
        }
        onPointerUp={commit}
        onKeyUp={(event) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(event.key)
          )
            commit();
        }}
      />
    </div>
  );
}
