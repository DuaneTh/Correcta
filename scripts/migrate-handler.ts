import { execSync } from "node:child_process";

export async function handler() {
  try {
    const output = execSync("node ./node_modules/prisma/build/index.js migrate deploy", {
      env: { ...process.env },
      encoding: "utf-8",
      timeout: 90_000,
    });
    console.log(output);
    return { statusCode: 200, body: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Migration failed:", message);
    return { statusCode: 500, body: message };
  }
}
