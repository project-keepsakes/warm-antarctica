import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createTestHarness } from "wrangler";

const root = fileURLToPath(new URL("../", import.meta.url));

test("the patched image stack emits a real PNG from a fresh isolated Worker build", { timeout: 180000 }, async () => {
  const fixture = await mkdtemp(path.join(root, ".security-og-"));
  let runtime;
  try {
    // Reuse installed packages; generate the source, output and runtime afresh.
    await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "junction");
    for (const name of ["package.json", "vite.config.ts", "next.config.ts", "tsconfig.json", "worker", "build", ".openai"]) {
      await cp(path.join(root, name), path.join(fixture, name), { recursive: true });
    }
    await mkdir(path.join(fixture, "app/api/image"), { recursive: true });
    await writeFile(path.join(fixture, "app/layout.tsx"), 'export default function Layout({children}) { return <html><body>{children}</body></html>; }');
    await writeFile(path.join(fixture, "app/page.tsx"), 'export default function Page() { return <div>Fixture</div>; }');
    await writeFile(path.join(fixture, "app/api/image/route.ts"), `
      import { ImageResponse } from "next/og";
      export function GET() {
        return new ImageResponse({type:"div",props:{style:{display:"flex",width:"100%",height:"100%",background:"white"}}},{width:64,height:32});
      }
    `);
    const built = spawnSync(process.execPath, [path.join(root, "node_modules/vinext/dist/cli.js"), "build"], {
      cwd: fixture, encoding: "utf8", timeout: 120000, windowsHide: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(fixture, ".wrangler/logs"), MINIFLARE_REGISTRY_PATH: path.join(fixture, ".wrangler/registry") },
    });
    assert.ifError(built.error);
    assert.equal(built.status, 0, built.stdout + built.stderr);
    runtime = createTestHarness({ workers: [{ configPath: path.join(fixture, "dist/server/wrangler.json") }] });
    await runtime.listen();
    const response = await runtime.fetch("/api/image");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 64);
    assert.equal(bytes.readUInt32BE(20), 32);
  } finally {
    if (runtime) await runtime.close();
    const absolute = path.resolve(fixture);
    if (path.dirname(absolute) !== path.resolve(root) || !path.basename(absolute).startsWith(".security-og-")) throw new Error("Unsafe fixture cleanup path");
    await rm(absolute, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
