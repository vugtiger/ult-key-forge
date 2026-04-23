import type { Color3, RInstance, UDim, UDim2 } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PropsProps {
  inst: RInstance;
  onUpdate: (patch: Partial<RInstance>) => void;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[100px_1fr] items-center gap-2 py-1">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <div>{children}</div>
  </div>
);

const NumIn = ({ value, onChange, step = 1 }: { value?: number; onChange: (n: number) => void; step?: number }) => (
  <Input
    type="number"
    step={step}
    value={value ?? 0}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className="h-7 text-xs"
  />
);

const UDimIn = ({ value, onChange }: { value?: UDim; onChange: (u: UDim) => void }) => (
  <div className="grid grid-cols-2 gap-1">
    <Input
      type="number"
      step={0.05}
      value={value?.scale ?? 0}
      onChange={(e) => onChange({ scale: parseFloat(e.target.value) || 0, offset: value?.offset ?? 0 })}
      className="h-7 text-xs"
      placeholder="scale"
    />
    <Input
      type="number"
      value={value?.offset ?? 0}
      onChange={(e) => onChange({ scale: value?.scale ?? 0, offset: parseFloat(e.target.value) || 0 })}
      className="h-7 text-xs"
      placeholder="offset"
    />
  </div>
);

const UDim2In = ({ value, onChange }: { value?: UDim2; onChange: (u: UDim2) => void }) => (
  <div className="space-y-1">
    <UDimIn value={value?.x} onChange={(x) => onChange({ x, y: value?.y ?? { scale: 0, offset: 0 } })} />
    <UDimIn value={value?.y} onChange={(y) => onChange({ y, x: value?.x ?? { scale: 0, offset: 0 } })} />
  </div>
);

const ColorIn = ({ value, onChange }: { value?: Color3; onChange: (c: Color3) => void }) => {
  const hex = value
    ? `#${[value.r, value.g, value.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    : "#ffffff";
  return (
    <input
      type="color"
      value={hex}
      onChange={(e) => {
        const v = e.target.value;
        onChange({
          r: parseInt(v.slice(1, 3), 16),
          g: parseInt(v.slice(3, 5), 16),
          b: parseInt(v.slice(5, 7), 16),
        });
      }}
      className="w-full h-7 rounded border border-input bg-background cursor-pointer"
    />
  );
};

const TextIn = ({ value, onChange }: { value?: string; onChange: (s: string) => void }) => (
  <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs" />
);

const SelectIn = ({
  value, onChange, options,
}: { value?: string; onChange: (s: string) => void; options: string[] }) => (
  <select
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className="h-7 w-full rounded border border-input bg-background text-xs px-2"
  >
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

export const Properties = ({ inst, onUpdate }: PropsProps) => {
  const isGui = !["UICorner","UIStroke","UIGradient","UIPadding","UIListLayout","UIGridLayout","UIAspectRatioConstraint","UISizeConstraint","UITextSizeConstraint","ScreenGui"].includes(inst.className);
  const hasText = inst.className === "TextLabel" || inst.className === "TextButton" || inst.className === "TextBox";
  const hasImage = inst.className === "ImageLabel" || inst.className === "ImageButton";

  return (
    <div className="p-3 space-y-3 text-xs overflow-y-auto">
      <div className="font-medium text-sm border-b border-border pb-2">{inst.className}</div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Identity</div>
        <Row label="Name"><TextIn value={inst.name} onChange={(name) => onUpdate({ name })} /></Row>
      </div>

      {isGui && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Layout</div>
          <Row label="Position"><UDim2In value={inst.position} onChange={(position) => onUpdate({ position })} /></Row>
          <Row label="Size"><UDim2In value={inst.size} onChange={(size) => onUpdate({ size })} /></Row>
          <Row label="Anchor X"><NumIn step={0.1} value={inst.anchorPoint?.x} onChange={(v) => onUpdate({ anchorPoint: { x: v, y: inst.anchorPoint?.y ?? 0 } })} /></Row>
          <Row label="Anchor Y"><NumIn step={0.1} value={inst.anchorPoint?.y} onChange={(v) => onUpdate({ anchorPoint: { x: inst.anchorPoint?.x ?? 0, y: v } })} /></Row>
          <Row label="Rotation"><NumIn value={inst.rotation} onChange={(rotation) => onUpdate({ rotation })} /></Row>
          <Row label="Z-Index"><NumIn value={inst.zIndex} onChange={(zIndex) => onUpdate({ zIndex })} /></Row>
        </div>
      )}

      {isGui && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Appearance</div>
          <Row label="Background"><ColorIn value={inst.backgroundColor3} onChange={(backgroundColor3) => onUpdate({ backgroundColor3 })} /></Row>
          <Row label="BG Trans"><NumIn step={0.05} value={inst.backgroundTransparency} onChange={(backgroundTransparency) => onUpdate({ backgroundTransparency })} /></Row>
          <Row label="Border"><NumIn value={inst.borderSizePixel} onChange={(borderSizePixel) => onUpdate({ borderSizePixel })} /></Row>
        </div>
      )}

      {hasText && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Text</div>
          <Row label="Text"><TextIn value={inst.text} onChange={(text) => onUpdate({ text })} /></Row>
          <Row label="Color"><ColorIn value={inst.textColor3} onChange={(textColor3) => onUpdate({ textColor3 })} /></Row>
          <Row label="Size"><NumIn value={inst.textSize} onChange={(textSize) => onUpdate({ textSize })} /></Row>
          <Row label="Font">
            <SelectIn
              value={inst.font}
              onChange={(font) => onUpdate({ font })}
              options={["Gotham","GothamBold","GothamMedium","GothamSemibold","SourceSans","SourceSansBold","Arial","ArialBold","Code"]}
            />
          </Row>
          <Row label="X Align"><SelectIn value={inst.textXAlignment} onChange={(v) => onUpdate({ textXAlignment: v as RInstance["textXAlignment"] })} options={["Left","Center","Right"]} /></Row>
          <Row label="Y Align"><SelectIn value={inst.textYAlignment} onChange={(v) => onUpdate({ textYAlignment: v as RInstance["textYAlignment"] })} options={["Top","Center","Bottom"]} /></Row>
        </div>
      )}

      {hasImage && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Image</div>
          <Row label="Image URL"><TextIn value={inst.image} onChange={(image) => onUpdate({ image })} /></Row>
          <Row label="Tint"><ColorIn value={inst.imageColor3} onChange={(imageColor3) => onUpdate({ imageColor3 })} /></Row>
          <Row label="Img Trans"><NumIn step={0.05} value={inst.imageTransparency} onChange={(imageTransparency) => onUpdate({ imageTransparency })} /></Row>
          <Row label="Scale Type"><SelectIn value={inst.scaleType} onChange={(v) => onUpdate({ scaleType: v as RInstance["scaleType"] })} options={["Stretch","Fit","Crop","Tile","Slice"]} /></Row>
        </div>
      )}

      {inst.className === "UICorner" && (
        <Row label="Radius"><UDimIn value={inst.cornerRadius} onChange={(cornerRadius) => onUpdate({ cornerRadius })} /></Row>
      )}
      {inst.className === "UIStroke" && (
        <>
          <Row label="Thickness"><NumIn value={inst.thickness} onChange={(thickness) => onUpdate({ thickness })} /></Row>
          <Row label="Color"><ColorIn value={inst.color} onChange={(color) => onUpdate({ color })} /></Row>
          <Row label="Trans"><NumIn step={0.05} value={inst.transparency} onChange={(transparency) => onUpdate({ transparency })} /></Row>
        </>
      )}
      {inst.className === "UIGradient" && (
        <>
          <Row label="Color 1"><ColorIn value={inst.gradientColor1} onChange={(gradientColor1) => onUpdate({ gradientColor1 })} /></Row>
          <Row label="Color 2"><ColorIn value={inst.gradientColor2} onChange={(gradientColor2) => onUpdate({ gradientColor2 })} /></Row>
          <Row label="Rotation"><NumIn value={inst.gradientRotation} onChange={(gradientRotation) => onUpdate({ gradientRotation })} /></Row>
        </>
      )}
      {inst.className === "UIPadding" && (
        <>
          <Row label="Top"><UDimIn value={inst.paddingTop} onChange={(paddingTop) => onUpdate({ paddingTop })} /></Row>
          <Row label="Bottom"><UDimIn value={inst.paddingBottom} onChange={(paddingBottom) => onUpdate({ paddingBottom })} /></Row>
          <Row label="Left"><UDimIn value={inst.paddingLeft} onChange={(paddingLeft) => onUpdate({ paddingLeft })} /></Row>
          <Row label="Right"><UDimIn value={inst.paddingRight} onChange={(paddingRight) => onUpdate({ paddingRight })} /></Row>
        </>
      )}
    </div>
  );
};
