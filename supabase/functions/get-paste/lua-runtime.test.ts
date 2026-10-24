import { test, expect } from "bun:test";
import { luaCompiler } from "./lua-runtime";
import { spawnSync } from "node:child_process";

function run(lua: string) {
  const result = spawnSync("lua", ["-"], { input: luaCompiler + lua, encoding: "utf8" });
  expect(result.status).toBe(0);
}

test("falls back when a cloned compiler returns nil", () => {
  run(`loadstring = loadstring or load
local fn = assert(_ultCompile("return 42", function() return nil, "clone failed" end))
assert(fn() == 42)`);
});

test("preserves compile errors rather than calling nil", () => {
  run(`loadstring = loadstring or load
local fn, err = _ultCompile('return "unfinished', loadstring)
assert(fn == nil)
assert(type(err) == "string" and #err > 0)`);
});

test("does not require coroutine or filesystem APIs", () => {
  run(`loadstring = loadstring or load
coroutine = nil
local fn = assert(_ultCompile("return 7", loadstring))
assert(fn() == 7)`);
});