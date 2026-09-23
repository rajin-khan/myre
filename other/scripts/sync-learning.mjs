import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const PEOPLE = ["rajin", "samiyeel", "saumik"];
const MAX_FILES = 200;
const MAX_BODY = 100000;

async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${full}`);
    if (entry.isDirectory()) results.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

function titleFrom(body, path) {
  return body.match(/^#\s+(.+)$/m)?.[1].trim().slice(0, 160) ||
    path.split("/").at(-1).replace(/\.md$/, "").replace(/[-_]/g, " ").slice(0, 160);
}

async function snapshot(root, branch, sha) {
  if (!branch || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Missing branch or commit SHA");
  const files = [];
  for (const author of PEOPLE) {
    for (const full of await walk(join(root, "learning", author))) {
      const path = relative(root, full).split("\\").join("/");
      const body = await readFile(full, "utf8");
      if (!body.length || body.length > MAX_BODY) throw new Error(`Note size is outside 1–100000 characters: ${path}`);
      files.push({ path, author, title: titleFrom(body, path), body, commit_sha: sha });
    }
  }
  if (files.length > MAX_FILES) throw new Error("Too many notes in this branch");
  return { branch, sha, files };
}

async function run() {
  const root = process.cwd();
  const branch = process.env.GITHUB_REF?.replace(/^refs\/heads\//, "");
  const sha = process.env.GITHUB_SHA;
  if (!process.env.GITHUB_REF?.startsWith("refs/heads/")) throw new Error("Only branch pushes can sync notebooks");
  const data = await snapshot(root, branch, sha);
  for (let attempt = 1; attempt <= 20; attempt++) {
    const audience = encodeURIComponent("myre-learning-sync");
    const tokenResponse = await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${audience}`, {
      headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    });
    if (!tokenResponse.ok) throw new Error(`Could not request GitHub identity: ${tokenResponse.status}`);
    const { value: token } = await tokenResponse.json();
    if (!token) throw new Error("GitHub identity token was empty");
    const response = await fetch("https://myre-os.vercel.app/api/learning-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      console.log(`Synced ${data.files.length} notebook files from ${branch}.`);
      return;
    }
    if (![404, 502, 503].includes(response.status) || attempt === 20) {
      throw new Error(`Notebook sync failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    console.log(`Site is still deploying (${response.status}); retrying notebook sync.`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

export { snapshot, titleFrom };
