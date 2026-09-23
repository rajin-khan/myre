const { createHmac, scryptSync, timingSafeEqual } = require("node:crypto");

const SUPABASE_URL = "https://pzooigdwmekbhhuzwmbe.supabase.co";
const PEOPLE = ["rajin", "samiyeel", "saumik"];
const FOLDERS = ["learn", "test", "make"];
const STATUSES = ["todo", "doing", "done"];
const COOKIE = "myre_session";
const WEEK = 7 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function passwordFor(name) {
  return process.env[`MYRE_PASSWORD_${name.toUpperCase()}`];
}

function configured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.MYRE_SESSION_SECRET?.length >= 32 &&
    PEOPLE.every((name) => Boolean(passwordFor(name))),
  );
}

function signature(name, expires) {
  return createHmac("sha256", process.env.MYRE_SESSION_SECRET)
    .update(`${name}.${expires}.${passwordFor(name)}`)
    .digest("base64url");
}

function sessionFor(request) {
  const raw = (request.headers.cookie || "").split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [name, expiresText, proof, extra] = raw.split(".");
  const expires = Number(expiresText);
  if (extra || !PEOPLE.includes(name) || !Number.isSafeInteger(expires) || expires <= Date.now()) return null;
  const expected = Buffer.from(signature(name, expiresText));
  const received = Buffer.from(proof || "");
  return received.length === expected.length && timingSafeEqual(received, expected) ? name : null;
}

function cookieFor(name) {
  const expires = Date.now() + WEEK * 1000;
  return `${COOKIE}=${name}.${expires}.${signature(name, expires)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${WEEK}`;
}

function sameOrigin(request) {
  try {
    const origin = new URL(request.headers.origin);
    return ["http:", "https:"].includes(origin.protocol) &&
      origin.host === request.headers.host?.toLowerCase();
  } catch {
    return false;
  }
}

function cleanText(value, limit) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit
    ? value.trim()
    : null;
}

async function database(table, method = "GET", query = {}, body) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(method === "GET" ? {} : {
        Prefer: method === "POST" && query.on_conflict
          ? "resolution=merge-duplicates,return=minimal"
          : "return=minimal",
      }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`database ${response.status}`);
  return method === "GET" ? response.json() : null;
}

async function readBoard() {
  const [videos, notes, tasks, checks, files] = await Promise.all([
    database("myre_videos", "GET", { select: "id,title,created_at", order: "created_at.desc" }),
    database("myre_notes", "GET", { select: "id,folder,title,body,created_at", order: "created_at.desc" }),
    database("myre_tasks", "GET", { select: "id,title,assignee,status,created_at", order: "created_at.desc" }),
    database("myre_checks", "GET", { select: "item_key,person_id,checked" }),
    database("myre_learning_files", "GET", { select: "branch,path,author,title,body,commit_sha,updated_at", order: "updated_at.desc" }),
  ]);
  return { videos, notes, tasks, checks, files };
}

async function changeBoard(action, input) {
  if (action === "video.add") {
    const id = input.id;
    const title = cleanText(input.title, 100);
    if (!VIDEO_ID.test(id) || !title) return false;
    await database("myre_videos", "POST", {}, { id, title });
  } else if (action === "video.remove") {
    if (!VIDEO_ID.test(input.id)) return false;
    await database("myre_videos", "DELETE", { id: `eq.${input.id}` });
  } else if (action === "note.add" || action === "note.update") {
    const folder = input.folder;
    const title = cleanText(input.title, 120);
    const body = cleanText(input.body, 20000);
    if (!FOLDERS.includes(folder) || !title || !body) return false;
    if (action === "note.update" && !UUID.test(input.id)) return false;
    await database("myre_notes", action === "note.add" ? "POST" : "PATCH",
      action === "note.add" ? {} : { id: `eq.${input.id}` }, { folder, title, body });
  } else if (action === "note.remove") {
    if (!UUID.test(input.id)) return false;
    await database("myre_notes", "DELETE", { id: `eq.${input.id}` });
  } else if (action === "task.add") {
    const title = cleanText(input.title, 120);
    if (!title || !PEOPLE.includes(input.assignee)) return false;
    await database("myre_tasks", "POST", {}, { title, assignee: input.assignee, status: "todo" });
  } else if (action === "task.update") {
    if (!UUID.test(input.id)) return false;
    const value = input.field === "assignee" && PEOPLE.includes(input.value)
      ? { assignee: input.value }
      : input.field === "status" && STATUSES.includes(input.value)
        ? { status: input.value }
        : null;
    if (!value) return false;
    await database("myre_tasks", "PATCH", { id: `eq.${input.id}` }, value);
  } else if (action === "task.remove") {
    if (!UUID.test(input.id)) return false;
    await database("myre_tasks", "DELETE", { id: `eq.${input.id}` });
  } else if (action === "check.set") {
    if (typeof input.item_key !== "string" || input.item_key.length > 100 ||
      !/^(video-|note-|lesson-)[A-Za-z0-9_-]{1,94}$/.test(input.item_key) ||
      !PEOPLE.includes(input.person_id) || typeof input.checked !== "boolean") return false;
    await database("myre_checks", "POST", { on_conflict: "item_key,person_id" }, {
      item_key: input.item_key,
      person_id: input.person_id,
      checked: input.checked,
    });
  } else {
    return false;
  }
  return true;
}

module.exports = async function studies(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) return response.status(405).json({ error: "Method not allowed." });
  if (!configured()) return response.status(503).json({ error: "Studies sign-in is not configured yet." });

  if (request.method === "POST") {
    if (!sameOrigin(request) || !request.headers["content-type"]?.startsWith("application/json")) {
      return response.status(403).json({ error: "Request not allowed." });
    }
    let input;
    try {
      input = request.body;
    } catch {
      return response.status(400).json({ error: "Invalid JSON." });
    }
    if (!input || typeof input !== "object" || Array.isArray(input) || JSON.stringify(input).length > 50000) {
      return response.status(400).json({ error: "Invalid request." });
    }
    if (input.action === "login") {
      const name = input.name;
      if (!PEOPLE.includes(name) || typeof input.password !== "string" || input.password.length > 256) {
        return response.status(401).json({ error: "Name or password is wrong." });
      }
      const salt = process.env.MYRE_SESSION_SECRET.slice(0, 32) + name;
      const entered = scryptSync(input.password, salt, 32);
      const expected = scryptSync(passwordFor(name), salt, 32);
      if (!timingSafeEqual(entered, expected)) {
        return response.status(401).json({ error: "Name or password is wrong." });
      }
      response.setHeader("Set-Cookie", cookieFor(name));
      return response.status(200).json({ name });
    }
    if (input.action === "logout") {
      response.setHeader("Set-Cookie", `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return response.status(200).json({ ok: true });
    }
    if (!sessionFor(request)) return response.status(401).json({ error: "Please sign in again." });
    try {
      if (!await changeBoard(input.action, input)) return response.status(400).json({ error: "Invalid change." });
      return response.status(200).json({ ok: true });
    } catch (error) {
      console.error("Studies write failed:", error);
      return response.status(502).json({ error: "Could not save that change." });
    }
  }

  const name = sessionFor(request);
  if (!name) return response.status(200).json({ name: null });
  try {
    return response.status(200).json({ name, ...(await readBoard()) });
  } catch (error) {
    console.error("Studies read failed:", error);
    return response.status(502).json({ error: "Could not load studies." });
  }
};
