// Advanced Multi-Layer Lua/Luau Obfuscator for Roblox
// Generates valid, executable obfuscated code

interface ObfuscationOptions {
  stringEncryption: boolean;
  variableMangling: boolean;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  opaquePredicates: boolean;
  antiTamper: boolean;
  junkCode: boolean;
  proxyFunctions: boolean;
  encryptionStrength: 'standard' | 'strong' | 'maximum';
}

// Character sets for variable name generation
const CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHARS_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARS_NUM = '0123456789';
const CHARS_ALL = CHARS_LOWER + CHARS_UPPER + '_';
const CHARS_START = CHARS_LOWER + CHARS_UPPER + '_';

// Generate confusing variable names
const generateVarName = (length: number = 12): string => {
  const prefixes = ['Il', 'lI', 'O0', '0O', 'I1', '1I', 'l1', '1l'];
  let result = prefixes[Math.floor(Math.random() * prefixes.length)];
  for (let i = 0; i < length; i++) {
    // Mix confusing characters: l, I, 1, O, 0
    const confusing = 'lI1O0lIlI1';
    result += confusing[Math.floor(Math.random() * confusing.length)];
  }
  return '_' + result;
};

// Generate unique identifier
const generateUID = (): string => {
  return '_' + Math.random().toString(36).substring(2, 10);
};

// Lua/Luau reserved keywords
const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'self', 'continue'
]);

// Roblox/Lua built-ins that shouldn't be renamed
const BUILTINS = new Set([
  'print', 'pairs', 'ipairs', 'next', 'type', 'tostring', 'tonumber',
  'error', 'assert', 'pcall', 'xpcall', 'select', 'unpack', 'rawget',
  'rawset', 'setmetatable', 'getmetatable', 'require', 'loadstring',
  'load', 'loadfile', 'dofile', 'collectgarbage', 'string', 'table',
  'math', 'bit32', 'os', 'io', 'debug', 'coroutine', 'package', 'utf8',
  '_G', '_VERSION', 'arg', 'game', 'workspace', 'script', 'wait', 'task',
  'spawn', 'delay', 'tick', 'time', 'warn', 'Instance', 'Vector3',
  'Vector2', 'CFrame', 'Color3', 'UDim2', 'UDim', 'Enum', 'Ray', 'typeof',
  'Region3', 'TweenInfo', 'NumberSequence', 'ColorSequence', 'Random',
  'NumberRange', 'Rect', 'BrickColor', 'PhysicalProperties', 'Axes',
  'Faces', 'PathWaypoint', 'DockWidgetPluginGuiInfo', 'RaycastParams',
  'OverlapParams', 'TweenService', 'RunService', 'Players', 'Lighting',
  'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'StarterGui',
  'StarterPlayer', 'StarterPack', 'Teams', 'SoundService', 'Chat',
  'LocalizationService', 'TestService', 'Debris', 'HttpService',
  'MarketplaceService', 'UserInputService', 'ContextActionService',
  'GuiService', 'HapticService', 'VRService', 'AssetService', 'BadgeService',
  'CollectionService', 'ContentProvider', 'DataStoreService', 'GroupService',
  'InsertService', 'KeyframeSequenceProvider', 'MemoryStoreService',
  'MessagingService', 'PathfindingService', 'PhysicsService', 'PolicyService',
  'ProximityPromptService', 'ReplicatedFirst', 'SocialService', 'TextService',
  'TeleportService', 'VoiceChatService', 'getfenv', 'setfenv', 'rawequal',
  'rawlen', 'getrawmetatable', 'setrawmetatable', 'newproxy', 'gcinfo',
  'bit', 'syn', 'hookfunction', 'hookmetamethod', 'getnamecallmethod',
  'setnamecallmethod', 'getgenv', 'getrenv', 'getsenv', 'getmenv',
  'getcallingscript', 'checkcaller', 'islclosure', 'iscclosure',
  'writefile', 'readfile', 'appendfile', 'loadfile', 'listfiles',
  'isfile', 'isfolder', 'makefolder', 'delfolder', 'delfile'
]);

// XOR function that works in Luau (without bit32)
const generateXorFunction = (funcName: string): string => {
  return `local ${funcName}=function(a,b)local p,c=1,0;while a>0 or b>0 do local ra,rb=a%2,b%2;if ra~=rb then c=c+p end;a,b,p=math.floor(a/2),math.floor(b/2),p*2 end;return c end`;
};

// Generate string decryption function
const generateDecryptor = (xorFunc: string, decryptFunc: string, key: number): string => {
  return `local ${decryptFunc}=function(t)local s=""for i=1,#t do s=s..string.char(${xorFunc}(t[i],(${key}+i-1)%256))end return s end`;
};

// Encrypt a string using XOR
const encryptString = (str: string, key: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const encrypted = charCode ^ ((key + i) % 256);
    result.push(encrypted);
  }
  return result;
};

// Generate anti-debug/anti-tamper code
const generateAntiTamper = (): string => {
  const v1 = generateVarName();
  const v2 = generateVarName();
  return `local ${v1}=function()local ${v2}=0 for i=1,100 do ${v2}=${v2}+1 end return ${v2}==100 end if not ${v1}()then return end`;
};

// Generate environment check (Roblox-specific)
const generateEnvCheck = (): string => {
  const v = generateVarName();
  return `local ${v}=game and workspace and script if not ${v} then return end`;
};

// Generate junk code that looks real but does nothing useful
const generateJunkCode = (): string => {
  const patterns = [
    () => {
      const v1 = generateVarName();
      const v2 = generateVarName();
      const n1 = Math.floor(Math.random() * 1000);
      const n2 = Math.floor(Math.random() * 100) + 1;
      return `local ${v1}=${n1} local ${v2}=${v1}*${n2}+${v1}`;
    },
    () => {
      const v = generateVarName();
      const vals = [Math.random().toFixed(4), Math.random().toFixed(4), Math.random().toFixed(4)];
      return `local ${v}={${vals.join(',')}}`;
    },
    () => {
      const f = generateVarName();
      const p = generateVarName();
      return `local ${f}=function(${p})return ${p} end`;
    },
    () => {
      const v = generateVarName();
      return `local ${v}=math.random()*math.pi`;
    },
    () => {
      const v = generateVarName();
      const n = Math.floor(Math.random() * 50) + 10;
      return `local ${v}=string.rep("",${n})`;
    }
  ];
  return patterns[Math.floor(Math.random() * patterns.length)]();
};

// Generate dead code block (code that never executes)
const generateDeadCode = (): string => {
  const v1 = generateVarName();
  const v2 = generateVarName();
  const impossibleConditions = [
    'type(1)=="string"',
    'math.pi<0',
    'false',
    '1>2',
    'nil',
  ];
  const cond = impossibleConditions[Math.floor(Math.random() * impossibleConditions.length)];
  return `if ${cond} then local ${v1}="${generateUID()}" local ${v2}=${v1} end`;
};

// Generate opaque predicate (always true but looks complex)
const generateOpaquePredicate = (): string => {
  const patterns = [
    '(1+1==2)',
    '(type("")=="string")',
    '(math.abs(-1)==1)',
    '(#""==0)',
    '(not not true)',
    '(nil==nil)',
    '(1~=2)',
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
};

// Mangle variable names in code
const mangleVariables = (code: string): { code: string; mapping: Map<string, string> } => {
  const mapping = new Map<string, string>();
  
  // Find local variable declarations
  const localVarRegex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  
  while ((match = localVarRegex.exec(code)) !== null) {
    const varName = match[1];
    if (!LUA_KEYWORDS.has(varName) && !BUILTINS.has(varName) && !mapping.has(varName)) {
      mapping.set(varName, generateVarName());
    }
  }
  
  // Find function declarations
  const funcDeclRegex = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  while ((match = funcDeclRegex.exec(code)) !== null) {
    const funcName = match[1];
    if (!LUA_KEYWORDS.has(funcName) && !BUILTINS.has(funcName) && !mapping.has(funcName)) {
      mapping.set(funcName, generateVarName());
    }
  }

  // Find function parameters
  const funcParamRegex = /function\s*(?:[a-zA-Z_][a-zA-Z0-9_]*)?\s*\(([^)]*)\)/g;
  while ((match = funcParamRegex.exec(code)) !== null) {
    const params = match[1].split(',').map(p => p.trim()).filter(p => p && /^[a-zA-Z_]/.test(p));
    params.forEach(param => {
      // Handle "..." vararg
      if (param === '...') return;
      const paramName = param.split(':')[0].trim(); // Handle typed params
      if (!LUA_KEYWORDS.has(paramName) && !BUILTINS.has(paramName) && !mapping.has(paramName)) {
        mapping.set(paramName, generateVarName());
      }
    });
  }
  
  // Replace all occurrences (whole word match)
  let mangledCode = code;
  // Sort by length descending to avoid partial replacements
  const sortedEntries = Array.from(mapping.entries()).sort((a, b) => b[0].length - a[0].length);
  
  for (const [oldName, newName] of sortedEntries) {
    const regex = new RegExp(`\\b${oldName}\\b(?![.:\\[])`, 'g');
    mangledCode = mangledCode.replace(regex, newName);
  }
  
  return { code: mangledCode, mapping };
};

// Encrypt all string literals
const encryptStrings = (code: string, decryptFunc: string, key: number): string => {
  // Match double-quoted strings (handling escapes)
  const stringRegex = /"((?:[^"\\]|\\.)*)"/g;
  
  let result = code;
  const matches: { full: string; content: string; encrypted: string }[] = [];
  
  let match;
  while ((match = stringRegex.exec(code)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    
    // Skip empty strings
    if (content.length === 0) continue;
    
    // Unescape the string content for encryption
    let unescaped = '';
    try {
      unescaped = content
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"');
    } catch {
      unescaped = content;
    }
    
    const encrypted = encryptString(unescaped, key);
    const replacement = `${decryptFunc}({${encrypted.join(',')}})`;
    
    matches.push({ full: fullMatch, content, encrypted: replacement });
  }
  
  // Also match single-quoted strings
  const singleQuoteRegex = /'((?:[^'\\]|\\.)*)'/g;
  while ((match = singleQuoteRegex.exec(code)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    
    if (content.length === 0) continue;
    
    let unescaped = '';
    try {
      unescaped = content
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'");
    } catch {
      unescaped = content;
    }
    
    const encrypted = encryptString(unescaped, key);
    const replacement = `${decryptFunc}({${encrypted.join(',')}})`;
    
    matches.push({ full: fullMatch, content, encrypted: replacement });
  }
  
  // Replace all matches
  for (const { full, encrypted } of matches) {
    result = result.replace(full, encrypted);
  }
  
  return result;
};

// Wrap code in control flow obfuscation
const wrapControlFlow = (code: string): string => {
  const stateVar = generateVarName();
  const funcTable = generateVarName();
  
  return `local ${stateVar}=1 local ${funcTable}={[1]=function()${code} ${stateVar}=0 end}while ${stateVar}~=0 do if ${funcTable}[${stateVar}]then ${funcTable}[${stateVar}]()else ${stateVar}=0 end end`;
};

// Number obfuscation - replace numbers with expressions
const obfuscateNumbers = (code: string): string => {
  // Replace simple integers with expressions
  return code.replace(/\b(\d+)\b/g, (match, num) => {
    const n = parseInt(num);
    if (n === 0) return '(1-1)';
    if (n === 1) return '(2-1)';
    if (n === 2) return '(1+1)';
    if (n < 10) {
      const a = Math.floor(Math.random() * 100) + n;
      const b = a - n;
      return `(${a}-${b})`;
    }
    return match;
  });
};

// Main obfuscation function
export const obfuscateLua = (
  sourceCode: string,
  options: ObfuscationOptions = {
    stringEncryption: true,
    variableMangling: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    opaquePredicates: true,
    antiTamper: true,
    junkCode: true,
    proxyFunctions: true,
    encryptionStrength: 'maximum',
  }
): string => {
  // Clean up the source code
  let code = sourceCode.trim();
  
  // Skip if empty
  if (!code) return '';
  
  const headerParts: string[] = [];
  const strengthMultiplier = 
    options.encryptionStrength === 'maximum' ? 3 :
    options.encryptionStrength === 'strong' ? 2 : 1;
  
  // Add anti-tamper checks
  if (options.antiTamper) {
    headerParts.push(generateEnvCheck());
    headerParts.push(generateAntiTamper());
  }
  
  // String encryption setup
  let xorFuncName = '';
  let decryptFuncName = '';
  let encryptionKey = 0;
  
  if (options.stringEncryption) {
    xorFuncName = generateVarName();
    decryptFuncName = generateVarName();
    encryptionKey = Math.floor(Math.random() * 200) + 50;
    
    headerParts.push(generateXorFunction(xorFuncName));
    headerParts.push(generateDecryptor(xorFuncName, decryptFuncName, encryptionKey));
  }
  
  // Inject dead code at the beginning
  if (options.deadCodeInjection) {
    const count = 3 * strengthMultiplier;
    for (let i = 0; i < count; i++) {
      headerParts.push(generateDeadCode());
    }
  }
  
  // Variable mangling
  if (options.variableMangling) {
    const result = mangleVariables(code);
    code = result.code;
  }
  
  // String encryption
  if (options.stringEncryption) {
    code = encryptStrings(code, decryptFuncName, encryptionKey);
  }
  
  // Inject junk code throughout
  if (options.junkCode) {
    const lines = code.split('\n');
    const newLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      // Inject junk before some lines
      if (Math.random() < 0.25 * strengthMultiplier) {
        newLines.push(generateJunkCode());
      }
      newLines.push(lines[i]);
      // Inject dead code after some lines
      if (Math.random() < 0.15 * strengthMultiplier) {
        newLines.push(generateDeadCode());
      }
    }
    code = newLines.join(' ');
  }
  
  // Wrap with opaque predicate
  if (options.opaquePredicates) {
    const pred = generateOpaquePredicate();
    code = `if ${pred} then ${code} end`;
  }
  
  // Control flow flattening
  if (options.controlFlowFlattening) {
    code = wrapControlFlow(code);
  }
  
  // Combine header and main code
  const allCode = [...headerParts, code].join(' ');
  
  // Final cleanup - remove extra whitespace and compress
  const finalCode = allCode
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()=,;<>+\-*/%])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  
  return finalCode;
};

export type { ObfuscationOptions };
