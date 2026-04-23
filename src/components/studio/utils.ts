import type { Color3, InstanceClass, RInstance, UDim, UDim2 } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const udim = (scale = 0, offset = 0): UDim => ({ scale, offset });
export const udim2 = (sx = 0, ox = 0, sy = 0, oy = 0): UDim2 => ({
  x: udim(sx, ox),
  y: udim(sy, oy),
});

export const c3 = (r = 255, g = 255, b = 255): Color3 => ({ r, g, b });

export const c3ToCss = (c?: Color3, t = 0) =>
  c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${1 - t})` : "transparent";

// Resolve UDim2 against a parent box (px)
export const resolveUDim2 = (u: UDim2 | undefined, parentW: number, parentH: number) => {
  if (!u) return { x: 0, y: 0 };
  return {
    x: (u.x.scale * parentW) + u.x.offset,
    y: (u.y.scale * parentW === undefined ? 0 : 0) + 0, // unused
  };
};

export const resolveSize = (u: UDim2 | undefined, parentW: number, parentH: number) => {
  if (!u) return { w: 0, h: 0 };
  return {
    w: (u.x.scale * parentW) + u.x.offset,
    h: (u.y.scale * parentH) + u.y.offset,
  };
};

export const resolvePos = (u: UDim2 | undefined, parentW: number, parentH: number) => {
  if (!u) return { x: 0, y: 0 };
  return {
    x: (u.x.scale * parentW) + u.x.offset,
    y: (u.y.scale * parentH) + u.y.offset,
  };
};

export const defaultInstance = (
  className: InstanceClass,
  parentId: string | null,
  index = 1,
): RInstance => {
  const base: RInstance = {
    id: uid(),
    className,
    name: `${className}${index > 1 ? index : ""}`,
    parentId,
  };
  switch (className) {
    case "ScreenGui":
      return { ...base, name: "ScreenGui" };
    case "Frame":
      return {
        ...base,
        position: udim2(0, 50, 0, 50),
        size: udim2(0, 200, 0, 150),
        anchorPoint: { x: 0, y: 0 },
        backgroundColor3: c3(45, 45, 50),
        backgroundTransparency: 0,
        borderSizePixel: 0,
        zIndex: 1,
        visible: true,
      };
    case "ScrollingFrame":
      return {
        ...base,
        position: udim2(0, 50, 0, 50),
        size: udim2(0, 250, 0, 200),
        backgroundColor3: c3(35, 35, 40),
        backgroundTransparency: 0,
        canvasSize: udim2(0, 0, 0, 600),
        scrollBarThickness: 6,
        borderSizePixel: 0,
        zIndex: 1,
        visible: true,
      };
    case "TextLabel":
      return {
        ...base,
        position: udim2(0, 0, 0, 0),
        size: udim2(0, 150, 0, 30),
        backgroundColor3: c3(255, 255, 255),
        backgroundTransparency: 1,
        text: "Label",
        textColor3: c3(255, 255, 255),
        textSize: 18,
        font: "Gotham",
        textXAlignment: "Center",
        textYAlignment: "Center",
        textWrapped: true,
        zIndex: 1,
        visible: true,
      };
    case "TextButton":
      return {
        ...base,
        position: udim2(0, 0, 0, 0),
        size: udim2(0, 120, 0, 36),
        backgroundColor3: c3(99, 102, 241),
        backgroundTransparency: 0,
        text: "Button",
        textColor3: c3(255, 255, 255),
        textSize: 16,
        font: "GothamBold",
        textXAlignment: "Center",
        textYAlignment: "Center",
        zIndex: 1,
        visible: true,
        borderSizePixel: 0,
      };
    case "TextBox":
      return {
        ...base,
        position: udim2(0, 0, 0, 0),
        size: udim2(0, 180, 0, 32),
        backgroundColor3: c3(30, 30, 35),
        backgroundTransparency: 0,
        text: "Type here...",
        textColor3: c3(220, 220, 220),
        textSize: 14,
        font: "Gotham",
        textXAlignment: "Left",
        textYAlignment: "Center",
        zIndex: 1,
        visible: true,
        borderSizePixel: 0,
      };
    case "ImageLabel":
      return {
        ...base,
        position: udim2(0, 0, 0, 0),
        size: udim2(0, 100, 0, 100),
        backgroundColor3: c3(255, 255, 255),
        backgroundTransparency: 1,
        image: "",
        imageColor3: c3(255, 255, 255),
        imageTransparency: 0,
        scaleType: "Stretch",
        zIndex: 1,
        visible: true,
      };
    case "ImageButton":
      return {
        ...base,
        position: udim2(0, 0, 0, 0),
        size: udim2(0, 100, 0, 100),
        backgroundColor3: c3(50, 50, 55),
        backgroundTransparency: 0,
        image: "",
        imageColor3: c3(255, 255, 255),
        imageTransparency: 0,
        scaleType: "Stretch",
        zIndex: 1,
        visible: true,
        borderSizePixel: 0,
      };
    case "UICorner":
      return { ...base, cornerRadius: udim(0, 8) };
    case "UIStroke":
      return { ...base, thickness: 1, color: c3(255, 255, 255), transparency: 0 };
    case "UIGradient":
      return { ...base, gradientColor1: c3(99, 102, 241), gradientColor2: c3(168, 85, 247), gradientRotation: 90 };
    case "UIPadding":
      return {
        ...base,
        paddingTop: udim(0, 8),
        paddingBottom: udim(0, 8),
        paddingLeft: udim(0, 8),
        paddingRight: udim(0, 8),
      };
    case "UIListLayout":
      return {
        ...base,
        fillDirection: "Vertical",
        horizontalAlignment: "Left",
        verticalAlignment: "Top",
        padding: udim(0, 4),
      };
    case "UIGridLayout":
      return {
        ...base,
        fillDirection: "Horizontal",
        horizontalAlignment: "Left",
        verticalAlignment: "Top",
        cellSize: udim2(0, 80, 0, 80),
        cellPadding: udim2(0, 4, 0, 4),
      };
    case "UIAspectRatioConstraint":
      return { ...base, aspectRatio: 1 };
    case "UISizeConstraint":
      return { ...base, minSize: { x: 0, y: 0 }, maxSize: { x: 9999, y: 9999 } };
    case "UITextSizeConstraint":
      return { ...base };
  }
};

// Given a children array find next-numbered name
export const nextIndexFor = (className: InstanceClass, all: RInstance[]) =>
  all.filter((i) => i.className === className).length + 1;

// Find children of a parent
export const childrenOf = (parentId: string | null, all: RInstance[]) =>
  all.filter((i) => i.parentId === parentId);

// Lua exporter
const luaUDim = (u?: UDim) => `UDim.new(${u?.scale ?? 0}, ${u?.offset ?? 0})`;
const luaUDim2 = (u?: UDim2) =>
  `UDim2.new(${u?.x.scale ?? 0}, ${u?.x.offset ?? 0}, ${u?.y.scale ?? 0}, ${u?.y.offset ?? 0})`;
const luaColor3 = (c?: Color3) =>
  `Color3.fromRGB(${c?.r ?? 255}, ${c?.g ?? 255}, ${c?.b ?? 255})`;
const luaStr = (s?: string) => `"${(s ?? "").replace(/"/g, '\\"')}"`;

const PROP_ORDER: Array<[keyof RInstance, (i: RInstance) => string | null]> = [
  ["name", (i) => `Name = ${luaStr(i.name)}`],
  ["position", (i) => (i.position ? `Position = ${luaUDim2(i.position)}` : null)],
  ["size", (i) => (i.size ? `Size = ${luaUDim2(i.size)}` : null)],
  ["anchorPoint", (i) => (i.anchorPoint ? `AnchorPoint = Vector2.new(${i.anchorPoint.x}, ${i.anchorPoint.y})` : null)],
  ["rotation", (i) => (i.rotation != null ? `Rotation = ${i.rotation}` : null)],
  ["zIndex", (i) => (i.zIndex != null ? `ZIndex = ${i.zIndex}` : null)],
  ["visible", (i) => (i.visible === false ? `Visible = false` : null)],
  ["backgroundColor3", (i) => (i.backgroundColor3 ? `BackgroundColor3 = ${luaColor3(i.backgroundColor3)}` : null)],
  ["backgroundTransparency", (i) => (i.backgroundTransparency != null ? `BackgroundTransparency = ${i.backgroundTransparency}` : null)],
  ["borderSizePixel", (i) => (i.borderSizePixel != null ? `BorderSizePixel = ${i.borderSizePixel}` : null)],
  ["text", (i) => (i.text != null ? `Text = ${luaStr(i.text)}` : null)],
  ["textColor3", (i) => (i.textColor3 ? `TextColor3 = ${luaColor3(i.textColor3)}` : null)],
  ["textSize", (i) => (i.textSize != null ? `TextSize = ${i.textSize}` : null)],
  ["font", (i) => (i.font ? `Font = Enum.Font.${i.font}` : null)],
  ["textXAlignment", (i) => (i.textXAlignment ? `TextXAlignment = Enum.TextXAlignment.${i.textXAlignment}` : null)],
  ["textYAlignment", (i) => (i.textYAlignment ? `TextYAlignment = Enum.TextYAlignment.${i.textYAlignment}` : null)],
  ["textWrapped", (i) => (i.textWrapped ? `TextWrapped = true` : null)],
  ["image", (i) => (i.image ? `Image = ${luaStr(i.image)}` : null)],
  ["imageColor3", (i) => (i.imageColor3 ? `ImageColor3 = ${luaColor3(i.imageColor3)}` : null)],
  ["imageTransparency", (i) => (i.imageTransparency != null && i.imageTransparency > 0 ? `ImageTransparency = ${i.imageTransparency}` : null)],
  ["scaleType", (i) => (i.scaleType ? `ScaleType = Enum.ScaleType.${i.scaleType}` : null)],
  ["canvasSize", (i) => (i.canvasSize ? `CanvasSize = ${luaUDim2(i.canvasSize)}` : null)],
  ["scrollBarThickness", (i) => (i.scrollBarThickness != null ? `ScrollBarThickness = ${i.scrollBarThickness}` : null)],
  ["cornerRadius", (i) => (i.cornerRadius ? `CornerRadius = ${luaUDim(i.cornerRadius)}` : null)],
  ["thickness", (i) => (i.thickness != null ? `Thickness = ${i.thickness}` : null)],
  ["color", (i) => (i.color ? `Color = ${luaColor3(i.color)}` : null)],
  ["transparency", (i) => (i.transparency != null && i.className !== "ImageLabel" && i.className !== "ImageButton" ? `Transparency = ${i.transparency}` : null)],
  ["paddingTop", (i) => (i.paddingTop ? `PaddingTop = ${luaUDim(i.paddingTop)}` : null)],
  ["paddingBottom", (i) => (i.paddingBottom ? `PaddingBottom = ${luaUDim(i.paddingBottom)}` : null)],
  ["paddingLeft", (i) => (i.paddingLeft ? `PaddingLeft = ${luaUDim(i.paddingLeft)}` : null)],
  ["paddingRight", (i) => (i.paddingRight ? `PaddingRight = ${luaUDim(i.paddingRight)}` : null)],
  ["fillDirection", (i) => (i.fillDirection ? `FillDirection = Enum.FillDirection.${i.fillDirection}` : null)],
  ["horizontalAlignment", (i) => (i.horizontalAlignment ? `HorizontalAlignment = Enum.HorizontalAlignment.${i.horizontalAlignment}` : null)],
  ["verticalAlignment", (i) => (i.verticalAlignment ? `VerticalAlignment = Enum.VerticalAlignment.${i.verticalAlignment}` : null)],
  ["padding", (i) => (i.padding ? `Padding = ${luaUDim(i.padding)}` : null)],
  ["cellSize", (i) => (i.cellSize ? `CellSize = ${luaUDim2(i.cellSize)}` : null)],
  ["cellPadding", (i) => (i.cellPadding ? `CellPadding = ${luaUDim2(i.cellPadding)}` : null)],
  ["aspectRatio", (i) => (i.aspectRatio != null ? `AspectRatio = ${i.aspectRatio}` : null)],
  ["minSize", (i) => (i.minSize ? `MinSize = Vector2.new(${i.minSize.x}, ${i.minSize.y})` : null)],
  ["maxSize", (i) => (i.maxSize ? `MaxSize = Vector2.new(${i.maxSize.x}, ${i.maxSize.y})` : null)],
];

const varName = (i: RInstance) =>
  `_${i.className.toLowerCase()}_${i.id.slice(0, 4)}`;

export const exportToLua = (instances: RInstance[]): string => {
  const screenGui = instances.find((i) => i.className === "ScreenGui");
  if (!screenGui) return "-- empty";
  const lines: string[] = [];
  lines.push(`-- Generated by ULT Cloud AI Studio`);
  lines.push(`local Players = game:GetService("Players")`);
  lines.push(`local LocalPlayer = Players.LocalPlayer`);
  lines.push(`local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")`);
  lines.push(``);

  const emit = (inst: RInstance, parentVar: string) => {
    const v = varName(inst);
    lines.push(`local ${v} = Instance.new("${inst.className}")`);
    for (const [, fn] of PROP_ORDER) {
      const line = fn(inst);
      if (line) lines.push(`${v}.${line}`);
    }
    lines.push(`${v}.Parent = ${parentVar}`);
    lines.push(``);
    for (const child of instances.filter((c) => c.parentId === inst.id)) {
      emit(child, v);
    }
  };

  const sgVar = varName(screenGui);
  lines.push(`local ${sgVar} = Instance.new("ScreenGui")`);
  lines.push(`${sgVar}.Name = ${luaStr(screenGui.name)}`);
  lines.push(`${sgVar}.ResetOnSpawn = false`);
  lines.push(`${sgVar}.Parent = PlayerGui`);
  lines.push(``);
  for (const child of instances.filter((c) => c.parentId === screenGui.id)) {
    emit(child, sgVar);
  }
  lines.push(`return ${sgVar}`);
  return lines.join("\n");
};
