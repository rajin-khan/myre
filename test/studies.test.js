const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../site/api/studies.js");

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(method, body, cookie, origin = "https://myre.example") {
  return {
    method,
    body,
    headers: {
      host: "myre.example",
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
  };
}

test("three-name password gate protects the board and writes", async () => {
  const oldEnv = { ...process.env };
  const oldFetch = global.fetch;
  const calls = [];
  try {
    process.env.MYRE_SESSION_SECRET = "a-long-independent-secret-for-testing-123";
    process.env.MYRE_PASSWORD_RAJIN = "x";
    process.env.MYRE_PASSWORD_SAMIYEEL = "samiyeel-random-test-password";
    process.env.MYRE_PASSWORD_SAUMIK = "saumik-random-test-password";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => [],
      };
    };

    let result = response();
    await handler(request("GET"), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { name: null });
    assert.equal(calls.length, 0);

    result = response();
    await handler(request("POST", { action: "task.add", title: "No access", assignee: "rajin" }), result);
    assert.equal(result.statusCode, 401);
    assert.equal(calls.length, 0);

    result = response();
    await handler(request("POST", { action: "login", name: "rajin", password: "wrong" }), result);
    assert.equal(result.statusCode, 401);
    assert.equal(calls.length, 0);

    const malformed = request("POST");
    Object.defineProperty(malformed, "body", { get() { throw new Error("bad JSON"); } });
    result = response();
    await handler(malformed, result);
    assert.equal(result.statusCode, 400);

    result = response();
    await handler(request("POST", { action: "login", name: "rajin", password: "x" },
      null, "https://another.example"), result);
    assert.equal(result.statusCode, 403);

    result = response();
    await handler(request("POST", { action: "login", name: "rajin", password: "x" }), result);
    assert.equal(result.statusCode, 200);
    const cookie = result.headers["set-cookie"].split(";")[0];
    assert.match(result.headers["set-cookie"], /HttpOnly; Secure; SameSite=Strict/);

    result = response();
    await handler(request("GET", null, cookie + "tampered"), result);
    assert.deepEqual(result.body, { name: null });

    result = response();
    await handler(request("GET", null, cookie), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.name, "rajin");
    assert.equal(calls.length, 5);
    assert.deepEqual(result.body.files, []);
    assert.ok(calls.every((call) => call.options.headers.apikey === "server-only-test-key"));

    result = response();
    await handler(request("POST", { action: "note.add", folder: "learn", title: "First note", body: "Hello" }, cookie), result);
    assert.equal(result.statusCode, 200);
    assert.equal(calls.at(-1).options.method, "POST");
    assert.match(calls.at(-1).url, /myre_notes$/);

    result = response();
    await handler(request("POST", { action: "note.add", folder: "wrong", title: "No", body: "No" }, cookie), result);
    assert.equal(result.statusCode, 400);

    result = response();
    await handler(request("POST", { action: "task.add", title: "Try a thing", assignee: "saumik" }, cookie), result);
    assert.equal(result.statusCode, 200);
    assert.match(calls.at(-1).url, /myre_tasks$/);

    result = response();
    await handler(request("POST", { action: "check.set", item_key: "lesson-what-is-an-os", person_id: "samiyeel", checked: true }, cookie), result);
    assert.equal(result.statusCode, 200);
    assert.match(calls.at(-1).url, /myre_checks\?on_conflict=item_key%2Cperson_id$/);

    process.env.MYRE_PASSWORD_RAJIN = "y";
    result = response();
    await handler(request("GET", null, cookie), result);
    assert.deepEqual(result.body, { name: null });
  } finally {
    process.env = oldEnv;
    global.fetch = oldFetch;
  }
});
