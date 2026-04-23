import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { RInstance } from "./types";
import { c3ToCss, resolvePos, resolveSize } from "./utils";
import { cn } from "@/lib/utils";

interface CanvasProps {
  instances: RInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<RInstance>) => void;
  canvasSize: { width: number; height: number };
  theme: "dark" | "light";
}

// Render an instance recursively
const RenderNode = ({
  inst,
  parentRect,
  all,
  selectedId,
  onSelect,
  onDragStart,
}: {
  inst: RInstance;
  parentRect: { w: number; h: number };
  all: RInstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string, mode: "move" | "resize") => void;
}) => {
  // Skip non-renderable modifiers; they apply via styles
  if (
    inst.className === "UICorner" ||
    inst.className === "UIStroke" ||
    inst.className === "UIGradient" ||
    inst.className === "UIPadding" ||
    inst.className === "UIListLayout" ||
    inst.className === "UIGridLayout" ||
    inst.className === "UIAspectRatioConstraint" ||
    inst.className === "UISizeConstraint" ||
    inst.className === "UITextSizeConstraint"
  ) return null;

  if (inst.visible === false) return null;

  const size = resolveSize(inst.size, parentRect.w, parentRect.h);
  const pos = resolvePos(inst.position, parentRect.w, parentRect.h);
  const ax = (inst.anchorPoint?.x ?? 0) * size.w;
  const ay = (inst.anchorPoint?.y ?? 0) * size.h;

  // Find modifiers among children
  const children = all.filter((c) => c.parentId === inst.id);
  const corner = children.find((c) => c.className === "UICorner");
  const stroke = children.find((c) => c.className === "UIStroke");
  const gradient = children.find((c) => c.className === "UIGradient");
  const padding = children.find((c) => c.className === "UIPadding");

  const radius = corner?.cornerRadius
    ? `${(corner.cornerRadius.scale * Math.min(size.w, size.h)) + corner.cornerRadius.offset}px`
    : "0px";

  const padL = padding?.paddingLeft ? padding.paddingLeft.scale * size.w + padding.paddingLeft.offset : 0;
  const padR = padding?.paddingRight ? padding.paddingRight.scale * size.w + padding.paddingRight.offset : 0;
  const padT = padding?.paddingTop ? padding.paddingTop.scale * size.h + padding.paddingTop.offset : 0;
  const padB = padding?.paddingBottom ? padding.paddingBottom.scale * size.h + padding.paddingBottom.offset : 0;

  const bg =
    inst.backgroundTransparency === 1
      ? "transparent"
      : c3ToCss(inst.backgroundColor3, inst.backgroundTransparency ?? 0);

  const gradientCss = gradient
    ? `linear-gradient(${(gradient.gradientRotation ?? 0) + 90}deg, ${c3ToCss(gradient.gradientColor1)}, ${c3ToCss(gradient.gradientColor2)})`
    : null;

  const isSelected = selectedId === inst.id;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: pos.x - ax,
    top: pos.y - ay,
    width: size.w,
    height: size.h,
    background: gradientCss ?? bg,
    borderRadius: radius,
    transform: inst.rotation ? `rotate(${inst.rotation}deg)` : undefined,
    zIndex: inst.zIndex ?? 1,
    boxShadow: stroke ? `0 0 0 ${stroke.thickness ?? 1}px ${c3ToCss(stroke.color, stroke.transparency ?? 0)} inset` : undefined,
    boxSizing: "border-box",
    paddingLeft: padL,
    paddingRight: padR,
    paddingTop: padT,
    paddingBottom: padB,
    overflow: inst.className === "ScrollingFrame" ? "auto" : "hidden",
    cursor: "pointer",
    userSelect: "none",
  };

  const textStyle: React.CSSProperties = {
    color: c3ToCss(inst.textColor3),
    fontSize: inst.textSize ?? 14,
    fontFamily: (inst.font ?? "Gotham").includes("Bold") ? "system-ui, -apple-system, sans-serif" : "system-ui, -apple-system, sans-serif",
    fontWeight: (inst.font ?? "").toLowerCase().includes("bold") ? 700 : 400,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems:
      inst.textYAlignment === "Top" ? "flex-start" :
      inst.textYAlignment === "Bottom" ? "flex-end" : "center",
    justifyContent:
      inst.textXAlignment === "Left" ? "flex-start" :
      inst.textXAlignment === "Right" ? "flex-end" : "center",
    whiteSpace: inst.textWrapped ? "normal" : "nowrap",
    wordBreak: inst.textWrapped ? "break-word" : "normal",
    overflow: "hidden",
    textAlign: (inst.textXAlignment?.toLowerCase() as React.CSSProperties["textAlign"]) ?? "center",
    pointerEvents: "none",
  };

  // Inner content rect used by children
  const innerRect = { w: size.w - padL - padR, h: size.h - padT - padB };

  const renderableChildren = children.filter((c) =>
    !["UICorner","UIStroke","UIGradient","UIPadding","UIListLayout","UIGridLayout","UIAspectRatioConstraint","UISizeConstraint","UITextSizeConstraint"].includes(c.className),
  );

  return (
    <div
      style={baseStyle}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(inst.id);
        onDragStart(e, inst.id, "move");
      }}
      className={cn(isSelected && "outline outline-2 outline-offset-0 outline-blue-500")}
    >
      {(inst.className === "ImageLabel" || inst.className === "ImageButton") && inst.image ? (
        <img
          src={inst.image}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: inst.scaleType === "Fit" ? "contain" : inst.scaleType === "Crop" ? "cover" : "fill",
            opacity: 1 - (inst.imageTransparency ?? 0),
            pointerEvents: "none",
          }}
        />
      ) : null}
      {(inst.text != null && (inst.className === "TextLabel" || inst.className === "TextButton" || inst.className === "TextBox")) && (
        <div style={textStyle}>{inst.text}</div>
      )}
      {renderableChildren.map((child) => (
        <RenderNode
          key={child.id}
          inst={child}
          parentRect={innerRect}
          all={all}
          selectedId={selectedId}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(e, inst.id, "resize");
          }}
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 cursor-se-resize z-50"
          style={{ pointerEvents: "auto" }}
        />
      )}
    </div>
  );
};

export const DesignerCanvas = ({
  instances,
  selectedId,
  onSelect,
  onUpdate,
  canvasSize,
  theme,
}: CanvasProps) => {
  const screenGui = useMemo(() => instances.find((i) => i.className === "ScreenGui"), [instances]);
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: RInstance } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent, id: string, mode: "move" | "resize") => {
    const inst = instances.find((i) => i.id === id);
    if (!inst) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id, mode, startX: e.clientX, startY: e.clientY, orig: { ...inst } };
  }, [instances]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === "move") {
        const op = d.orig.position ?? { x: { scale: 0, offset: 0 }, y: { scale: 0, offset: 0 } };
        onUpdate(d.id, {
          position: {
            x: { scale: op.x.scale, offset: op.x.offset + dx },
            y: { scale: op.y.scale, offset: op.y.offset + dy },
          },
        });
      } else {
        const os = d.orig.size ?? { x: { scale: 0, offset: 100 }, y: { scale: 0, offset: 100 } };
        onUpdate(d.id, {
          size: {
            x: { scale: os.x.scale, offset: Math.max(8, os.x.offset + dx) },
            y: { scale: os.y.scale, offset: Math.max(8, os.y.offset + dy) },
          },
        });
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onUpdate]);

  if (!screenGui) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No ScreenGui</div>;
  }

  const rootChildren = instances.filter((c) => c.parentId === screenGui.id);

  return (
    <div className="relative flex-1 overflow-auto bg-muted/30 p-6">
      <div
        className="relative mx-auto shadow-2xl"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          background: theme === "dark"
            ? "linear-gradient(180deg, #1a2332 0%, #0f1828 100%)"
            : "linear-gradient(180deg, #f0f4f8 0%, #d9e2ec 100%)",
        }}
        onPointerDown={() => onSelect(null)}
      >
        {rootChildren.map((c) => (
          <RenderNode
            key={c.id}
            inst={c}
            parentRect={{ w: canvasSize.width, h: canvasSize.height }}
            all={instances}
            selectedId={selectedId}
            onSelect={onSelect}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
    </div>
  );
};
