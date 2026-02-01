// Advanced Multi-Layer Lua Obfuscator
// Implements multiple protection techniques for maximum code obfuscation

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

// Generate random string for variable names
const generateRandomName = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  const startChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  let result = startChars[Math.floor(Math.random() * startChars.length)];
  for (let i = 1; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

// Generate random hex-like variable name
const generateHexName = (): string => {
  const prefix = ['_', 'L_', 'v_', 'f_', 'x_'][Math.floor(Math.random() * 5)];
  const hex = Math.random().toString(16).substring(2, 10).toUpperCase();
  return prefix + hex;
};

// XOR encryption for strings
const xorEncrypt = (str: string, key: number): number[] => {
  const encrypted: number[] = [];
  for (let i = 0; i < str.length; i++) {
    encrypted.push(str.charCodeAt(i) ^ ((key + i) % 256));
  }
  return encrypted;
};

// Generate decryption function
const generateDecryptor = (key: number, funcName: string): string => {
  return `local ${funcName}=(function(a,b)local c=""for d=1,#a do c=c..string.char(bit32.bxor(a[d],(b+d-1)%256))end return c end)`;
};

// Generate anti-tamper check
const generateAntiTamper = (): string => {
  const checkVar = generateHexName();
  const funcVar = generateHexName();
  return `local ${checkVar}=(function()local ${funcVar}=0;for i=1,1000 do ${funcVar}=${funcVar}+math.random()end;return ${funcVar}>0 end)();if not ${checkVar} then return end;`;
};

// Generate opaque predicate (always true/false but looks complex)
const generateOpaquePredicate = (shouldBeTrue: boolean): string => {
  const x = generateHexName();
  const y = generateHexName();
  if (shouldBeTrue) {
    const patterns = [
      `((${x}*${x}+1)>0)`,
      `((${x}%2==0)or(${x}%2==1))`,
      `(type("")=="string")`,
      `((${x}+1)~=${x})`,
      `(math.abs(${y})>=0)`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  } else {
    const patterns = [
      `(type(0)=="string")`,
      `((${x}+1)==${x})`,
      `(math.abs(${y})<0)`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }
};

// Generate junk code that does nothing but looks real
const generateJunkCode = (): string => {
  const junkPatterns = [
    () => {
      const v1 = generateHexName();
      const v2 = generateHexName();
      return `local ${v1}=${Math.floor(Math.random() * 1000)};local ${v2}=${v1}*${Math.floor(Math.random() * 100)};${v2}=${v2}+${v1};`;
    },
    () => {
      const v = generateHexName();
      return `local ${v}={};for _=${Math.floor(Math.random() * 10)},${Math.floor(Math.random() * 5) + 10} do ${v}[#${v}+1]=math.random()end;`;
    },
    () => {
      const v = generateHexName();
      const tbl = generateHexName();
      return `local ${tbl}={${Math.random()},${Math.random()},${Math.random()}};local ${v}=${tbl}[math.random(1,3)];`;
    },
    () => {
      const f = generateHexName();
      return `local ${f}=function(...)local a={...}return#a end;${f}(${Math.random()},${Math.random()});`;
    },
  ];
  return junkPatterns[Math.floor(Math.random() * junkPatterns.length)]();
};

// Generate dead code block
const generateDeadCodeBlock = (): string => {
  const condition = generateOpaquePredicate(false);
  const v1 = generateHexName();
  const v2 = generateHexName();
  return `if ${condition} then local ${v1}="${generateRandomName(16)}";local ${v2}=function()return ${v1}end;print(${v2}())end;`;
};

// Generate proxy function wrapper
const generateProxyFunction = (originalCall: string, proxyName: string): string => {
  const argNames = [generateHexName(), generateHexName(), generateHexName()];
  return `local ${proxyName}=(function(${argNames[0]},${argNames[1]},${argNames[2]})return ${originalCall}(${argNames[0]},${argNames[1]},${argNames[2]})end)`;
};

// Control flow flattening - converts linear code to state machine
const flattenControlFlow = (codeBlock: string): string => {
  const stateVar = generateHexName();
  const jumpTable = generateHexName();
  
  // This is a simplified version - real CFG would parse AST
  const wrappedCode = `
local ${stateVar}=1
local ${jumpTable}={
  [1]=function()
    ${codeBlock}
    ${stateVar}=0
  end
}
while ${stateVar}~=0 do
  if ${jumpTable}[${stateVar}] then
    ${jumpTable}[${stateVar}]()
  else
    ${stateVar}=0
  end
end`;
  return wrappedCode;
};

// Encrypt all strings in code
const encryptStrings = (code: string, decryptorName: string, key: number): string => {
  // Match string literals (simplified - doesn't handle all edge cases)
  const stringRegex = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
  
  return code.replace(stringRegex, (match) => {
    const content = match.slice(1, -1); // Remove quotes
    if (content.length === 0) return match;
    
    const encrypted = xorEncrypt(content, key);
    return `${decryptorName}({${encrypted.join(',')}},${key})`;
  });
};

// Mangle variable names
const mangleVariables = (code: string): { code: string; mapping: Map<string, string> } => {
  const mapping = new Map<string, string>();
  const luaKeywords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
    'then', 'true', 'until', 'while', 'self'
  ]);
  
  const builtins = new Set([
    'print', 'pairs', 'ipairs', 'next', 'type', 'tostring', 'tonumber',
    'error', 'assert', 'pcall', 'xpcall', 'select', 'unpack', 'rawget',
    'rawset', 'setmetatable', 'getmetatable', 'require', 'loadstring',
    'load', 'loadfile', 'dofile', 'collectgarbage', 'string', 'table',
    'math', 'bit32', 'os', 'io', 'debug', 'coroutine', 'package',
    '_G', '_VERSION', 'arg', 'game', 'workspace', 'script', 'wait',
    'spawn', 'delay', 'tick', 'time', 'warn', 'Instance', 'Vector3',
    'Vector2', 'CFrame', 'Color3', 'UDim2', 'UDim', 'Enum', 'Ray',
    'Region3', 'TweenInfo', 'NumberSequence', 'ColorSequence', 'typeof'
  ]);

  // Find local variable declarations
  const localVarRegex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  
  while ((match = localVarRegex.exec(code)) !== null) {
    const varName = match[1];
    if (!luaKeywords.has(varName) && !builtins.has(varName) && !mapping.has(varName)) {
      mapping.set(varName, generateHexName());
    }
  }
  
  // Find function declarations
  const funcRegex = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  while ((match = funcRegex.exec(code)) !== null) {
    const funcName = match[1];
    if (!luaKeywords.has(funcName) && !builtins.has(funcName) && !mapping.has(funcName)) {
      mapping.set(funcName, generateHexName());
    }
  }

  // Find function parameters
  const paramRegex = /function\s*[a-zA-Z_][a-zA-Z0-9_]*?\s*\(([^)]*)\)/g;
  while ((match = paramRegex.exec(code)) !== null) {
    const params = match[1].split(',').map(p => p.trim()).filter(p => p);
    params.forEach(param => {
      if (!luaKeywords.has(param) && !builtins.has(param) && !mapping.has(param)) {
        mapping.set(param, generateHexName());
      }
    });
  }
  
  // Replace all occurrences
  let mangledCode = code;
  mapping.forEach((newName, oldName) => {
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    mangledCode = mangledCode.replace(regex, newName);
  });
  
  return { code: mangledCode, mapping };
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
  let obfuscatedCode = sourceCode;
  const headerParts: string[] = [];
  
  // Determine iteration counts based on strength
  const strengthMultiplier = 
    options.encryptionStrength === 'maximum' ? 3 :
    options.encryptionStrength === 'strong' ? 2 : 1;
  
  // Add anti-tamper protection
  if (options.antiTamper) {
    headerParts.push(generateAntiTamper());
  }
  
  // String encryption
  if (options.stringEncryption) {
    const decryptorName = generateHexName();
    const key = Math.floor(Math.random() * 200) + 50;
    headerParts.push(generateDecryptor(key, decryptorName));
    
    for (let i = 0; i < strengthMultiplier; i++) {
      const newKey = Math.floor(Math.random() * 200) + 50;
      const newDecryptor = generateHexName();
      headerParts.push(generateDecryptor(newKey, newDecryptor));
    }
    
    obfuscatedCode = encryptStrings(obfuscatedCode, decryptorName, key);
  }
  
  // Variable mangling
  if (options.variableMangling) {
    const result = mangleVariables(obfuscatedCode);
    obfuscatedCode = result.code;
  }
  
  // Inject junk code throughout
  if (options.junkCode) {
    const lines = obfuscatedCode.split('\n');
    const newLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (Math.random() < 0.3 * strengthMultiplier) {
        newLines.push(generateJunkCode());
      }
      newLines.push(lines[i]);
    }
    obfuscatedCode = newLines.join('\n');
  }
  
  // Dead code injection
  if (options.deadCodeInjection) {
    const deadCodeCount = 5 * strengthMultiplier;
    let deadCodeBlocks = '';
    for (let i = 0; i < deadCodeCount; i++) {
      deadCodeBlocks += generateDeadCodeBlock();
    }
    obfuscatedCode = deadCodeBlocks + obfuscatedCode;
  }
  
  // Opaque predicates - wrap code sections
  if (options.opaquePredicates) {
    const predicate = generateOpaquePredicate(true);
    const wrapperVar = generateHexName();
    obfuscatedCode = `local ${wrapperVar}=${Math.floor(Math.random() * 1000)};if ${predicate.replace(/\bx\b/g, wrapperVar).replace(/\by\b/g, wrapperVar)} then\n${obfuscatedCode}\nend`;
  }
  
  // Control flow flattening
  if (options.controlFlowFlattening) {
    obfuscatedCode = flattenControlFlow(obfuscatedCode);
  }
  
  // Combine header and code
  const fullCode = [
    '-- Protected by ULT LUA Advanced Obfuscator',
    '-- Deobfuscation is prohibited and will result in code failure',
    `-- Generated: ${new Date().toISOString()}`,
    '',
    ...headerParts,
    '',
    obfuscatedCode
  ].join('\n');
  
  // Final minification pass
  return fullCode
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('--'))
    .join(' ');
};

export type { ObfuscationOptions };
