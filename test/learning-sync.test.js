const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const handler = require("../site/api/learning-sync.js");

function response() {
  return {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("only this repository's branch workflow can sync notebooks", async () => {
  const oldFetch = global.fetch;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const sha = "a".repeat(40);
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "myre-learning-sync",
    repository: "rajin-khan/myre",
    repository_id: "1382919842",
    ref: "refs/heads/notes",
    workflow_ref: "rajin-khan/myre/.github/workflows/sync-learning.yml@refs/heads/notes",
    event_name: "push",
    sha,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const tokenFor = (values) => {
    const first = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url");
    const second = Buffer.from(JSON.stringify(values)).toString("base64url");
    const signature = sign("RSA-SHA256", Buffer.from(`${first}.${second}`), privateKey).toString("base64url");
    return `${first}.${second}.${signature}`;
  };
  let writes = 0;
  global.fetch = async (url, options) => {
    if (String(url).includes("jwks")) return { ok: true, json: async () => ({ keys: [{ ...jwk, kid: "test" }] }) };
    writes += 1;
    assert.equal(options.headers.apikey, "test-server-key");
    return { ok: true };
  };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
  const body = { branch: "notes", sha, files: [{ path: "learning/rajin/hello.md", author: "rajin", title: "Hello", body: "# Hello", commit_sha: sha }] };
  const call = async (token, data = body) => {
    const result = response();
    await handler({ method: "POST", body: data, headers: { "content-type": "application/json", authorization: `Bearer ${token}` } }, result);
    return result;
  };
  try {
    assert.equal((await call(tokenFor(claims))).statusCode, 200);
    assert.equal(writes, 1);
    assert.equal((await call(tokenFor({ ...claims, repository_id: "other" }))).statusCode, 401);
    assert.equal((await call(tokenFor({ ...claims, workflow_ref: "rajin-khan/myre/.github/workflows/other.yml@refs/heads/notes" }))).statusCode, 401);
    assert.equal((await call(tokenFor({ ...claims, exp: 1 }))).statusCode, 401);
    assert.equal((await call(tokenFor(claims), { ...body, files: [{ ...body.files[0], path: "learning/saumik/hello.md" }] })).statusCode, 400);
    assert.equal(writes, 1);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
