import { after } from "node:test";
import { createTestHarness } from "wrangler";

const runtime = createTestHarness({
  workers: [{ configPath: new URL("../dist/server/wrangler.json", import.meta.url) }],
});
let started;
after(async () => { await runtime.close(); });

export async function fetchWorker(pathname = "/") {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) throw new Error("Expected a local Worker path");
  await (started ??= runtime.listen());
  return runtime.fetch(pathname, { headers: { accept: "text/html" } });
}
