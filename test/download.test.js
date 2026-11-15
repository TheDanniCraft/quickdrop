import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
delete process.env.ENABLE_METRICS;
const { getFiles } = await import("../src/app/action.js");

test("downloads contain the uploaded fixture files and missing codes return null", async () => {
  const previousCwd = process.cwd();
  const fixture = await mkdtemp(join(tmpdir(), "quickdrop-download-"));
  try {
    process.chdir(fixture);
    await mkdir("data/FIXTURE", { recursive: true });
    await writeFile("data/FIXTURE/hello.txt", "hello fixture");
    await writeFile("data/FIXTURE/second.txt", "second fixture");
    expect(await getFiles("MISSING")).toBeNull();
    const archive = await getFiles("FIXTURE");
    expect(Buffer.isBuffer(archive)).toBe(true);
    expect(archive.subarray(0, 2).toString()).toBe("PK");
    const archivePath = join(fixture, "download.zip");
    await writeFile(archivePath, archive);
    for (const [name, contents] of [["hello.txt", "hello fixture"], ["second.txt", "second fixture"]]) {
      const child = Bun.spawn(["unzip", "-p", archivePath, name], { stdout: "pipe", stderr: "pipe" });
      expect(await new Response(child.stdout).text()).toBe(contents);
      expect(await child.exited).toBe(0);
    }
  } finally {
    process.chdir(previousCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});

