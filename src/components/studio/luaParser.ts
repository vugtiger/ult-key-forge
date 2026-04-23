import type { Color3, InstanceClass, RInstance, UDim, UDim2 } from "./types";
import { c3, udim, udim2, uid } from "./utils";

// Best-effort parser for AI-generated Roblox UI Lua of the form:
// local x = Instance.new("Frame"); x.Position = UDim2.new(...); x.Parent = parent
// Returns instance tree rooted under a ScreenGui (creates one if missing).
export function parseLuaUI(lua: string): RInstance[] | null {
  if (!/Instance\.new\(/i.test(lua)) return null;

  type Decl = { var: string; className: InstanceClass; props: Record<string, string>; parentVar: string | null };
  const decls = new Map<string, Decl>();
  const order: string[] = [];

  // Match: local <var> = Instance.new("ClassName")
  const declRe = /local\s+(\w+)\s*=\s*Instance\.new\(\s*["']([\w]+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(lua))) {
    const [, v, cls] = m;
    decls.set(v, { var: v, className: cls as InstanceClass, props: {}, parentVar: null });
    order.push(v);
  }

  // Match assignments: var.Prop = value (value is the rest of the line up to ; or \n)
  const assignRe = /(\w+)\.(\w+)\s*=\s*([^\n;]+)/g;
  while ((m = assignRe.exec(lua))) {
    const [, v, prop, raw] = m;
    if (!decls.has(v)) continue;
    decls.get(v)!.props[prop] = raw.trim();
  }

  // Resolve parents from x.Parent = y
  decls.forEach((d) => {
    const p = d.props["Parent"];
    if (p) {
      const t = p.trim();
      if (decls.has(t)) d.parentVar = t;
    }
  });

  const result: RInstance[] = [];
  const idMap = new Map<string, string>();

  // Ensure root ScreenGui
  let rootVar = order.find((v) => decls.get(v)!.className === "ScreenGui");
  if (!rootVar) {
    const sg: RInstance = { id: uid(), className: "ScreenGui", name: "ScreenGui", parentId: null };
    result.push(sg);
    // Treat top-level (no parent in decls) instances as children of this ScreenGui
    rootVar = "__synthetic_root__";
    idMap.set(rootVar, sg.id);
  }

  const allowed: InstanceClass[] = [
    "ScreenGui","Frame","ScrollingFrame","TextLabel","TextButton","TextBox",
    "ImageLabel","ImageButton","UICorner","UIStroke","UIGradient","UIPadding",
    "UIListLayout","UIGridLayout","UIAspectRatioConstraint","UISizeConstraint","UITextSizeConstraint",
  ];

  // First pass: create instances
  for (const v of order) {
    const d = decls.get(v)!;
    if (!allowed.includes(d.className)) continue;
    const inst: RInstance = {
      id: uid(),
      className: d.className,
      name: parseStr(d.props["Name"]) ?? d.className,
      parentId: null,
    };
    applyParsedProps(inst, d.props);
    idMap.set(v, inst.id);
    result.push(inst);
  }

  // Second pass: parents
  for (const v of order) {
    const d = decls.get(v)!;
    const me = result.find((r) => r.id === idMap.get(v));
    if (!me) continue;
    if (d.parentVar && idMap.has(d.parentVar)) {
      me.parentId = idMap.get(d.parentVar)!;
    } else if (d.className !== "ScreenGui") {
      // Attach to root ScreenGui
      const root = result.find((r) => r.className === "ScreenGui");
      if (root) me.parentId = root.id;
    }
  }

  return result;
}

function parseStr(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/^["'](.*)["']$/);
  return m ? m[1] : undefined;
}

function parseNum(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw);
  return isNaN(n) ? undefined : n;
}

function parseUDim(raw?: string): UDim | undefined {
  if (!raw) return undefined;
  const m = raw.match(/UDim\.new\(\s*([^,]+),\s*([^)]+)\)/);
  if (!m) return undefined;
  return udim(parseFloat(m[1]) || 0, parseFloat(m[2]) || 0);
}

function parseUDim2(raw?: string): UDim2 | undefined {
  if (!raw) return undefined;
  const m = raw.match(/UDim2\.new\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
  if (m) {
    return udim2(parseFloat(m[1]) || 0, parseFloat(m[2]) || 0, parseFloat(m[3]) || 0, parseFloat(m[4]) || 0);
  }
  const f = raw.match(/UDim2\.fromOffset\(\s*([^,]+),\s*([^)]+)\)/);
  if (f) return udim2(0, parseFloat(f[1]) || 0, 0, parseFloat(f[2]) || 0);
  const s = raw.match(/UDim2\.fromScale\(\s*([^,]+),\s*([^)]+)\)/);
  if (s) return udim2(parseFloat(s[1]) || 0, 0, parseFloat(s[2]) || 0, 0);
  return undefined;
}

function parseColor3(raw?: string): Color3 | undefined {
  if (!raw) return undefined;
  const m = raw.match(/Color3\.fromRGB\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
  if (m) return c3(+m[1] | 0, +m[2] | 0, +m[3] | 0);
  const n = raw.match(/Color3\.new\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
  if (n) return c3(Math.round((+n[1] || 0) * 255), Math.round((+n[2] || 0) * 255), Math.round((+n[3] || 0) * 255));
  return undefined;
}

function parseEnum(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/Enum\.\w+\.(\w+)/);
  return m ? m[1] : undefined;
}

function applyParsedProps(inst: RInstance, p: Record<string, string>) {
  if (p["Position"]) inst.position = parseUDim2(p["Position"]);
  if (p["Size"]) inst.size = parseUDim2(p["Size"]);
  if (p["AnchorPoint"]) {
    const m = p["AnchorPoint"].match(/Vector2\.new\(\s*([^,]+),\s*([^)]+)\)/);
    if (m) inst.anchorPoint = { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 };
  }
  if (p["Rotation"]) inst.rotation = parseNum(p["Rotation"]);
  if (p["ZIndex"]) inst.zIndex = parseNum(p["ZIndex"]);
  if (p["Visible"]) inst.visible = !/false/i.test(p["Visible"]);
  if (p["BackgroundColor3"]) inst.backgroundColor3 = parseColor3(p["BackgroundColor3"]);
  if (p["BackgroundTransparency"]) inst.backgroundTransparency = parseNum(p["BackgroundTransparency"]);
  if (p["BorderSizePixel"]) inst.borderSizePixel = parseNum(p["BorderSizePixel"]);
  if (p["Text"]) inst.text = parseStr(p["Text"]);
  if (p["TextColor3"]) inst.textColor3 = parseColor3(p["TextColor3"]);
  if (p["TextSize"]) inst.textSize = parseNum(p["TextSize"]);
  if (p["Font"]) inst.font = parseEnum(p["Font"]);
  if (p["TextXAlignment"]) inst.textXAlignment = parseEnum(p["TextXAlignment"]) as RInstance["textXAlignment"];
  if (p["TextYAlignment"]) inst.textYAlignment = parseEnum(p["TextYAlignment"]) as RInstance["textYAlignment"];
  if (p["TextWrapped"]) inst.textWrapped = /true/i.test(p["TextWrapped"]);
  if (p["Image"]) inst.image = parseStr(p["Image"]);
  if (p["ImageColor3"]) inst.imageColor3 = parseColor3(p["ImageColor3"]);
  if (p["ImageTransparency"]) inst.imageTransparency = parseNum(p["ImageTransparency"]);
  if (p["ScaleType"]) inst.scaleType = parseEnum(p["ScaleType"]) as RInstance["scaleType"];
  if (p["CanvasSize"]) inst.canvasSize = parseUDim2(p["CanvasSize"]);
  if (p["ScrollBarThickness"]) inst.scrollBarThickness = parseNum(p["ScrollBarThickness"]);
  if (p["CornerRadius"]) inst.cornerRadius = parseUDim(p["CornerRadius"]);
  if (p["Thickness"]) inst.thickness = parseNum(p["Thickness"]);
  if (p["Color"]) inst.color = parseColor3(p["Color"]);
  if (p["Transparency"]) inst.transparency = parseNum(p["Transparency"]);
  if (p["PaddingTop"]) inst.paddingTop = parseUDim(p["PaddingTop"]);
  if (p["PaddingBottom"]) inst.paddingBottom = parseUDim(p["PaddingBottom"]);
  if (p["PaddingLeft"]) inst.paddingLeft = parseUDim(p["PaddingLeft"]);
  if (p["PaddingRight"]) inst.paddingRight = parseUDim(p["PaddingRight"]);
  if (p["FillDirection"]) inst.fillDirection = parseEnum(p["FillDirection"]) as RInstance["fillDirection"];
  if (p["HorizontalAlignment"]) inst.horizontalAlignment = parseEnum(p["HorizontalAlignment"]) as RInstance["horizontalAlignment"];
  if (p["VerticalAlignment"]) inst.verticalAlignment = parseEnum(p["VerticalAlignment"]) as RInstance["verticalAlignment"];
  if (p["Padding"]) inst.padding = parseUDim(p["Padding"]);
  if (p["CellSize"]) inst.cellSize = parseUDim2(p["CellSize"]);
  if (p["CellPadding"]) inst.cellPadding = parseUDim2(p["CellPadding"]);
  if (p["AspectRatio"]) inst.aspectRatio = parseNum(p["AspectRatio"]);
}

// Detect first lua code-block in markdown
export function extractFirstLuaBlock(md: string): string | null {
  const m = md.match(/```lua\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : null;
}

// Detect HTML/CSS/JS code blocks
export function extractWebBlock(md: string): { html: string; css: string; js: string } | null {
  const html = md.match(/```html\s*([\s\S]*?)```/i)?.[1];
  const css = md.match(/```css\s*([\s\S]*?)```/i)?.[1];
  const js = md.match(/```(?:js|javascript)\s*([\s\S]*?)```/i)?.[1];
  if (!html && !css && !js) return null;
  return { html: html ?? "", css: css ?? "", js: js ?? "" };
}
