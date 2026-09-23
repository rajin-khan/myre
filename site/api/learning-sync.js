const { createPublicKey, verify } = require("node:crypto");

const SUPABASE_URL = "https://pzooigdwmekbhhuzwmbe.supabase.co";
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "myre-learning-sync";
const REPOSITORY = "rajin-khan/myre";
const REPOSITORY_ID = "1382919842";
const PEOPLE = new Set(["rajin", "samiyeel", "saumik"]);
const SHA = /^[a-f0-9]{40}$/;
const PATH = /^learning\/(rajin|samiyeel|saumik)\/(?!\.)(?:[^/]+\/)*[^/]+\.md$/i;
let keysCache = null;

function jsonError(response, code, error) {
  return response.status(code).json({ error });
}

function decodeJsonPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function githubKeys() {
  if (keysCache && keysCache.expires > Date.now()) return keysCache.keys;
  const response = await fetch(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("GitHub keys unavailable");
  const result = await response.json();
  if (!Array.isArray(result.keys)) throw new Error("Invalid GitHub keys");
  keysCache = { keys: result.keys, expires: Date.now() + 5 * 60_000 };
  return result.keys;
}

async function claimsFor(token) {
  if (typeof token !== "string" || token.length > 10000) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header;
  let claims;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
  } catch { return null; }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const key = (await githubKeys()).find((item) => item.kid === header.kid && item.kty === "RSA");
  if (!key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"))) return null;
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE ||
      claims.repository !== REPOSITORY || String(claims.repository_id) !== REPOSITORY_ID ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + 60 ||
      (claims.nbf !== undefined && claims.nbf > now) ||
      !["push", "workflow_dispatch"].includes(claims.event_name) ||
      typeof claims.ref !== "string" || !claims.ref.startsWith("refs/heads/") ||
      claims.workflow_ref !== `${REPOSITORY}/.github/workflows/sync-learning.yml@${claims.ref}`) return null;
  return claims;
}

function validSnapshot(body, claims) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      body.branch !== claims.ref.slice("refs/heads/".length) ||
      body.sha !== claims.sha || !SHA.test(body.sha) ||
      !Array.isArray(body.files) || body.files.length > 200) return false;
  const paths = new Set();
  for (const file of body.files) {
    if (!file || typeof file !== "object" || Array.isArray(file) ||
        typeof file.path !== "string" || !PATH.test(file.path) || file.path.length > 500 ||
        file.path.includes("..") || file.path.includes("\\") || paths.has(file.path) ||
        !PEOPLE.has(file.author) || file.path.split("/")[1] !== file.author ||
        typeof file.title !== "string" || file.title.trim().length < 1 || file.title.length > 160 ||
        typeof file.body !== "string" || file.body.length < 1 || file.body.length > 100000 ||
        file.commit_sha !== body.sha) return false;
    paths.add(file.path);
  }
  return true;
}

module.exports = async function learningSync(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return jsonError(response, 405, "Method not allowed.");
  if (!request.headers["content-type"]?.startsWith("application/json")) return jsonError(response, 415, "JSON required.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonError(response, 503, "Sync is not configured.");
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  let claims;
  try { claims = await claimsFor(token); } catch (error) {
    console.error("GitHub identity check failed:", error);
    return jsonError(response, 503, "Identity check unavailable.");
  }
  if (!claims) return jsonError(response, 401, "Invalid GitHub identity.");
  const body = request.body;
  if (!validSnapshot(body, claims) || JSON.stringify(body).length > 1_000_000) {
    return jsonError(response, 400, "Invalid notebook snapshot.");
  }
  try {
    const database = await fetch(`${SUPABASE_URL}/rest/v1/rpc/myre_sync_learning_files`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_branch: body.branch, p_files: body.files }),
      signal: AbortSignal.timeout(10000),
    });
    if (!database.ok) throw new Error(`database ${database.status}`);
    return response.status(200).json({ ok: true, branch: body.branch, files: body.files.length });
  } catch (error) {
    console.error("Notebook sync failed:", error);
    return jsonError(response, 502, "Could not sync notebooks.");
  }
};

module.exports._test = { validSnapshot, claimsFor };
