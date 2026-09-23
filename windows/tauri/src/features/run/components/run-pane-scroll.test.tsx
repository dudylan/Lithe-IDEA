import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("run pane scroll-to-end behavior regression", async () => {
  // The scenario replaces the stores RunPane reads with bun module mocks.
  // CI runs every file under src/features/run in one process and bun keeps
  // module mocks for the whole process, so the scenario must run in its own
  // child process to keep sibling store tests on the real modules.
  const child = Bun.spawn([
    process.execPath,
    "test",
    fileURLToPath(new URL("./run-pane-scroll.scenario.tsx", import.meta.url)),
    "--timeout", "5000",
  ], { stdout: "pipe", stderr: "pipe", timeout: 15000 });
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, output: code === 0 ? "" : stdout + stderr }).toEqual({ code: 0, output: "" });
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}, 20000);
