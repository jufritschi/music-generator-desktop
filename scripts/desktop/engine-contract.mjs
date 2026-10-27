import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

// Keeping stdin open also supports the real sandboxed app supervisor on macOS.
async function steps(executable, requested, supervisor) {
  const args=["--desktop-iteration-probe",String(requested)];
  const child=spawn(supervisor || executable,supervisor ? ["--engine-supervisor",executable,...args] : args,{
    cwd:path.dirname(executable),stdio:["pipe","pipe","pipe"],windowsHide:true,
    env:{...process.env,GGML_BACKEND:"CPU"},
  });
  let output="",error="";
  child.stdout.on("data",chunk=>{output+=chunk;});
  child.stderr.on("data",chunk=>{error+=chunk;});
  const timeout=setTimeout(()=>{child.stdin.end();child.kill();},15000).unref();
  try {
    const [code]=await once(child,"exit");
    assert.equal(code,0,`Engine iteration probe failed: ${error || output}`);
    return Number(output.trim().split(/\r?\n/).at(-1));
  } finally {clearTimeout(timeout);child.stdin.end();if(child.exitCode===null)child.kill();}
}

export async function verifyIterationContract(executable, supervisor) {
  for (const [requested,expected] of [[0,50],[120,120],[200,200],[201,200]]) {
    assert.equal(await steps(executable,requested,supervisor),expected,`Engine changed ${requested} requested iterations`);
  }
  return 200;
}
