import { it } from "node:test";
import assert from "node:assert/strict";
import { dllExports } from "./prepare-windows-engine.mjs";

it("derives import names from native DLL exports without copying ordinals or forwarded destinations",()=>{
  const output=`Dump of file ggml.dll
      ordinal hint RVA      name
            1    0 00001230 ggml_backend_init_best
            2    A 0000ABCD ggml_backend_load_all_from_path
            3    B 00001240 ggml_forwarded = another.dll.target
      Summary
            1000 .data
  `;
  assert.deepEqual(dllExports(output),["ggml_backend_init_best","ggml_backend_load_all_from_path","ggml_forwarded"]);
});

it("rejects missing or incompatible DLL exports instead of building an unverified import library",()=>{
  assert.throws(()=>dllExports("dumpbin failed: invalid image"),/exports are missing/);
});
