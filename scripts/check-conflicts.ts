import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const conflicts: string[] = [];
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: process.cwd() });
  const files = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const file of files) {
    let content = "";
    try {
      content = await fs.readFile(file, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        continue;
      }
      throw error;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const isStart = line.startsWith("<<<<<<< ");
      const isMiddle = line === "=======";
      const isEnd = line.startsWith(">>>>>>> ");
      if (isStart || isMiddle || isEnd) {
        conflicts.push(`${file}:${i + 1}:${line}`);
      }
    }
  }

  if (conflicts.length > 0) {
    console.error("[check-conflicts] Merge conflict markers detected:");
    for (const line of conflicts) {
      console.error(` - ${line}`);
    }
    process.exit(1);
  }

  console.log("[check-conflicts] No conflict markers found.");
}

main().catch((error) => {
  console.error("[check-conflicts] Failed:", (error as Error).message);
  process.exit(1);
});
