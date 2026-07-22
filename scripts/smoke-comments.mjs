import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const postsDir = path.join(projectRoot, "posts");
const dataDir = path.join(projectRoot, "data");
const commentsFile = path.join(dataDir, "post-comments.json");
const metricsFile = path.join(dataDir, "post-metrics.json");
const postFile = `comment-smoke-${process.pid}.md`;
const postPath = path.join(postsDir, postFile);

async function snapshot(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function restore(file, content) {
  if (content === null) {
    await fs.rm(file, { force: true });
  } else {
    await fs.writeFile(file, content);
  }
}

function parseMcpResponse(text) {
  const dataLine = text
    .split("\n")
    .find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice(6) : text);
}

let requestId = 0;
async function mcpRequest(baseUrl, method, params, sessionId) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} failed: ${response.status} ${text}`);
  const payload = parseMcpResponse(text);
  assert.equal(payload.error, undefined, `${method} returned ${JSON.stringify(payload.error)}`);
  return { payload, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

function toolJson(payload) {
  const text = payload.result.content.find((item) => item.type === "text")?.text;
  assert.ok(text, "tool response did not contain text content");
  return JSON.parse(text);
}

async function waitUntilReady(baseUrl) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/readyz`);
      if (response.ok) return;
    } catch {
      // The child may still be binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("MCP server did not become ready");
}

const commentsSnapshot = await snapshot(commentsFile);
const metricsSnapshot = await snapshot(metricsFile);
let child;
let mock;

try {
  await fs.mkdir(postsDir, { recursive: true });
  await fs.writeFile(postPath, "---\ntitle: Comment smoke test\n---\n\nTemporary test post.\n");

  let observedRemoteRequest;
  mock = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    observedRemoteRequest = { path: url.pathname, query: Object.fromEntries(url.searchParams) };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([{ id_code: "remote1", children: [] }]));
  });
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");
  const mockPort = mock.address().port;

  const mcpPort = 31_000 + (process.pid % 10_000);
  const baseUrl = `http://127.0.0.1:${mcpPort}`;
  child = spawn(process.execPath, ["dist/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MCP_HOST: "127.0.0.1",
      MCP_PORT: String(mcpPort),
      DEV_TO_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitUntilReady(baseUrl);
  const initialized = await mcpRequest(baseUrl, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "comment-smoke", version: "1.0.0" },
  });
  assert.equal(initialized.payload.result.serverInfo.name, "dev-io");
  assert.equal(initialized.payload.result.serverInfo.version, "0.2.0");
  const sessionId = initialized.sessionId;
  assert.ok(sessionId, "initialize did not return an MCP session id");

  const tools = await mcpRequest(baseUrl, "tools/list", {}, sessionId);
  const toolNames = tools.payload.result.tools.map((tool) => tool.name);
  for (const name of ["list_post_comments", "add_post_comment", "reply_post_comment"]) {
    assert.ok(toolNames.includes(name), `${name} was not discovered`);
  }

  const added = await mcpRequest(
    baseUrl,
    "tools/call",
    { name: "add_post_comment", arguments: { file: postFile, body: "Top level", author: "smoke" } },
    sessionId,
  );
  const addedResult = toolJson(added.payload);
  assert.equal(addedResult.ok, true);
  assert.equal(addedResult.comment.parentId, null);

  const replied = await mcpRequest(
    baseUrl,
    "tools/call",
    {
      name: "reply_post_comment",
      arguments: { file: postFile, comment_id: addedResult.comment.id, body: "Nested reply", author: "smoke" },
    },
    sessionId,
  );
  const repliedResult = toolJson(replied.payload);
  assert.equal(repliedResult.comment.parentId, addedResult.comment.id);
  assert.equal(repliedResult.metrics.comments, 2);

  const listed = await mcpRequest(
    baseUrl,
    "tools/call",
    { name: "list_post_comments", arguments: { source: "local", file: postFile } },
    sessionId,
  );
  const listedResult = toolJson(listed.payload);
  assert.equal(listedResult.comments.length, 1);
  assert.equal(listedResult.comments[0].replies.length, 1);
  assert.equal(listedResult.comments[0].replies[0].body, "Nested reply");

  const remote = await mcpRequest(
    baseUrl,
    "tools/call",
    {
      name: "list_post_comments",
      arguments: { source: "remote", article_id: 321, page: 2, per_page: 5 },
    },
    sessionId,
  );
  const remoteResult = toolJson(remote.payload);
  assert.equal(remoteResult.comments[0].id_code, "remote1");
  assert.deepEqual(observedRemoteRequest, {
    path: "/api/comments",
    query: { a_id: "321", per_page: "5", page: "2" },
  });

  console.log("comment MCP smoke test passed");
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  if (mock) {
    mock.close();
    await once(mock, "close");
  }
  await fs.rm(postPath, { force: true });
  await restore(commentsFile, commentsSnapshot);
  await restore(metricsFile, metricsSnapshot);
}
