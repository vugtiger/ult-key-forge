// Roblox UI Designer instance model
export type InstanceClass =
  | "ScreenGui"
  | "Frame"
  | "ScrollingFrame"
  | "TextLabel"
  | "TextButton"
  | "TextBox"
  | "ImageLabel"
  | "ImageButton"
  | "UICorner"
  | "UIStroke"
  | "UIGradient"
  | "UIPadding"
  | "UIListLayout"
  | "UIGridLayout"
  | "UIAspectRatioConstraint"
  | "UISizeConstraint"
  | "UITextSizeConstraint";

export interface UDim {
  scale: number;
  offset: number;
}

export interface UDim2 {
  x: UDim;
  y: UDim;
}

export interface Color3 {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface RInstance {
  id: string;
  className: InstanceClass;
  name: string;
  parentId: string | null;
  // Layout (GuiObject)
  position?: UDim2;
  size?: UDim2;
  anchorPoint?: { x: number; y: number };
  rotation?: number;
  zIndex?: number;
  visible?: boolean;
  // Appearance
  backgroundColor3?: Color3;
  backgroundTransparency?: number;
  borderSizePixel?: number;
  // Text
  text?: string;
  textColor3?: Color3;
  textSize?: number;
  font?: string;
  textXAlignment?: "Left" | "Center" | "Right";
  textYAlignment?: "Top" | "Center" | "Bottom";
  textWrapped?: boolean;
  // Image
  image?: string;
  imageColor3?: Color3;
  imageTransparency?: number;
  scaleType?: "Stretch" | "Fit" | "Crop" | "Tile" | "Slice";
  // ScrollingFrame
  canvasSize?: UDim2;
  scrollBarThickness?: number;
  // UICorner
  cornerRadius?: UDim;
  // UIStroke
  thickness?: number;
  color?: Color3;
  transparency?: number;
  // UIGradient
  gradientColor1?: Color3;
  gradientColor2?: Color3;
  gradientRotation?: number;
  // UIPadding
  paddingTop?: UDim;
  paddingBottom?: UDim;
  paddingLeft?: UDim;
  paddingRight?: UDim;
  // UIListLayout / UIGridLayout
  fillDirection?: "Horizontal" | "Vertical";
  horizontalAlignment?: "Left" | "Center" | "Right";
  verticalAlignment?: "Top" | "Center" | "Bottom";
  padding?: UDim;
  cellSize?: UDim2;
  cellPadding?: UDim2;
  // UIAspectRatioConstraint
  aspectRatio?: number;
  // UISizeConstraint
  minSize?: { x: number; y: number };
  maxSize?: { x: number; y: number };
}

export interface StudioFile {
  id: string;
  name: string;
  language: "lua" | "html" | "css" | "javascript" | "typescript" | "tsx" | "json" | "markdown" | "plaintext";
  content: string;
}

export interface StudioProject {
  files: StudioFile[];
  activeFileId: string | null;
  openTabs: string[];
  uiInstances: RInstance[];
  selectedInstanceId: string | null;
  canvasSize: { width: number; height: number };
  theme: "dark" | "light";
}
