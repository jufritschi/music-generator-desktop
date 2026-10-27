import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

it("keeps engine patches usable in Windows Git checkouts", async () => {
  const work=await mkdtemp(path.join(tmpdir(),"desktop-patch-checkout-"));
  try {
    const git=(...args)=>execFileSync("git",args,{cwd:work,stdio:"pipe"});
    git("init");
    git("config","core.autocrlf","true");
    await writeFile(path.join(work,".gitattributes"),await readFile(new URL("../../.gitattributes",import.meta.url)));
    await writeFile(path.join(work,"engine.patch"),await readFile(new URL("./patches/acestep-iterations-windows.patch",import.meta.url)));
    git("add",".gitattributes","engine.patch");
    await rm(path.join(work,"engine.patch"));
    git("checkout-index","engine.patch");
    const patch=await readFile(path.join(work,"engine.patch"));
    assert.equal(patch.includes(13),false,"CRLF patch context cannot match the upstream LF sources");
  } finally {await rm(work,{recursive:true,force:true});}
});
