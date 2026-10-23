/** Compile without requiring filesystem APIs or coroutine support. */
export const luaCompiler = `local function _ultCompile(code, preferred)
  local lastError = "loadstring is unavailable in this executor"
  local candidates = {preferred, loadstring}
  for i = 1, 2 do
    local compiler = candidates[i]
    if type(compiler) == "function" then
      local ok, fn, err = pcall(compiler, code)
      if ok and type(fn) == "function" then
        -- File/clone compilers may use a restricted environment lacking executor APIs.
        if type(setfenv) == "function" and type(getfenv) == "function" then
          pcall(function() setfenv(fn, getfenv(0)) end)
        end
        return fn
      end
      lastError = tostring(ok and err or fn)
    end
  end
  return nil, lastError
end
`;