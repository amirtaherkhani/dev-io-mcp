import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const postsDir = path.join(projectRoot, "posts");
const dataDir = path.join(projectRoot, "data");
const metricsFile = path.join(dataDir, "post-metrics.json");
const remotePostsFile = path.join(dataDir, "remote-posts.json");

type PostMetrics = {
  views: number;
  likes: number;
  bookmarks: number;
  shares: number;
  comments: number;
  updatedAt: string;
};

type PublishPostInput = {
  title: string;
  summary: string;
  conversation?: string;
  author?: string;
  source?: string;
  topic?: string;
  tags?: string[];
};

type PostMetricsEvent = "view" | "like" | "bookmark" | "share" | "comment";

type RemoteDevIoAdapterConfig = {
  baseUrl: string | null;
  token: string | null;
};

type DevToPublisherConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string | null;
  userAgent: string;
  published: boolean;
};

type RemotePostLink = {
  platform: "dev.to";
  baseUrl: string;
  articleId: number | string;
  url: string | null;
  published: boolean;
  publishedAt: string;
};

type RemoteArticleSnapshot = {
  platform: "dev.to";
  articleId: number | string;
  title?: string;
  url?: string;
  published?: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  fetchedAt: string;
};

function loadRemoteAdapterConfig(): RemoteDevIoAdapterConfig {
  return {
    baseUrl: process.env.DEV_IO_API_BASE_URL ?? null,
    token: process.env.DEV_IO_API_TOKEN ?? null,
  };
}

function loadDevToPublisherConfig(): DevToPublisherConfig {
  return {
    enabled: process.env.DEV_TO_PUBLISH === "true",
    baseUrl: process.env.DEV_TO_API_BASE_URL ?? "https://dev.to",
    apiKey: process.env.DEV_TO_API_KEY ?? null,
    userAgent:
      process.env.DEV_TO_USER_AGENT ??
      "dev-io-mcp/0.1.0 (https://github.com/amirtaherkhani/dev-io-mcp)",
    published: process.env.DEV_TO_PUBLISHED !== "false",
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

function renderPost(input: PublishPostInput): string {
  const createdAt = new Date().toISOString();
  const tags = input.tags?.length ? input.tags : ["mcp", "ai", "dev-io"];
  const sections = [
    "---",
    `title: ${input.title}`,
    `author: ${input.author ?? "dev.io"}`,
    `source: ${input.source ?? "ai-conversation"}`,
    `topic: ${input.topic ?? "communication-result"}`,
    `createdAt: ${createdAt}`,
    `views: 0`,
    `likes: 0`,
    `bookmarks: 0`,
    `shares: 0`,
    `comments: 0`,
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
    "## Summary",
    "",
    input.summary.trim(),
  ];

  if (input.conversation?.trim()) {
    sections.push("", "## Conversation", "", input.conversation.trim());
  }

  sections.push("", "## Metadata", "", `- status: published`, `- id: ${randomUUID()}`);
  return sections.join("\n");
}

async function ensurePostsDir(): Promise<void> {
  await fs.mkdir(postsDir, { recursive: true });
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
}

async function listPostFiles(): Promise<string[]> {
  await ensurePostsDir();
  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function resolvePostPath(file: string): string {
  const candidate = path.isAbsolute(file) ? file : path.join(postsDir, file);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(postsDir + path.sep) && normalized !== postsDir) {
    throw new Error(`Refusing to read outside posts directory: ${file}`);
  }
  return normalized;
}

function metricsForFile(file: string): PostMetrics {
  return {
    views: 0,
    likes: 0,
    bookmarks: 0,
    shares: 0,
    comments: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function readAllMetrics(): Promise<Record<string, PostMetrics>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(metricsFile, "utf8");
    return JSON.parse(raw) as Record<string, PostMetrics>;
  } catch (error) {
    return {};
  }
}

async function writeAllMetrics(metrics: Record<string, PostMetrics>): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
}

async function readRemotePostLinks(): Promise<Record<string, RemotePostLink>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(remotePostsFile, "utf8");
    return JSON.parse(raw) as Record<string, RemotePostLink>;
  } catch {
    return {};
  }
}

async function writeRemotePostLinks(links: Record<string, RemotePostLink>): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(remotePostsFile, JSON.stringify(links, null, 2), "utf8");
}

function articleUrl(baseUrl: string, article: Record<string, unknown>): string | null {
  if (typeof article.url === "string") {
    return article.url;
  }

  if (typeof article.path === "string") {
    return new URL(article.path, baseUrl).toString();
  }

  return null;
}

async function publishPostToDevTo(
  fileName: string,
  input: PublishPostInput,
  bodyMarkdown: string,
): Promise<{ published: boolean; mode: string; articleId?: number | string; url?: string | null }> {
  const config = loadDevToPublisherConfig();
  if (!config.enabled) {
    return { published: false, mode: "local" };
  }

  if (!config.apiKey) {
    throw new Error("DEV_TO_API_KEY is required when DEV_TO_PUBLISH=true");
  }

  const tags = (input.tags?.length ? input.tags : ["mcp", "ai", "dev-io"]).slice(0, 4);
  const response = await fetch(new URL("/api/articles", config.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/vnd.forem.api-v1+json",
      "api-key": config.apiKey,
      "user-agent": config.userAgent,
    },
    body: JSON.stringify({
      article: {
        title: input.title,
        body_markdown: bodyMarkdown,
        published: config.published,
        description: input.summary.trim().slice(0, 160),
        tags,
      },
    }),
  });

  const responseText = await response.text();
  let article: Record<string, unknown>;
  try {
    article = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    article = {};
  }

  if (!response.ok) {
    const detail = responseText.replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`DEV.to publish failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  const articleId = article.id;
  if (typeof articleId !== "number" && typeof articleId !== "string") {
    throw new Error("DEV.to publish response did not include an article id");
  }

  const url = articleUrl(config.baseUrl, article);
  const links = await readRemotePostLinks();
  links[fileName] = {
    platform: "dev.to",
    baseUrl: config.baseUrl,
    articleId,
    url,
    published: config.published,
    publishedAt: new Date().toISOString(),
  };
  await writeRemotePostLinks(links);

  return { published: true, mode: "dev.to", articleId, url };
}

async function fetchRemoteArticleSnapshot(fileName: string): Promise<RemoteArticleSnapshot | null> {
  const links = await readRemotePostLinks();
  const link = links[fileName];
  if (!link) {
    return null;
  }

  const config = loadDevToPublisherConfig();
  try {
    const response = await fetch(new URL(`/api/articles/${link.articleId}`, link.baseUrl), {
      headers: {
        accept: "application/vnd.forem.api-v1+json",
        "user-agent": config.userAgent,
        ...(config.apiKey ? { "api-key": config.apiKey } : {}),
      },
    });

    if (!response.ok) {
      return {
        platform: link.platform,
        articleId: link.articleId,
        url: link.url ?? undefined,
        fetchedAt: new Date().toISOString(),
      };
    }

    const article = (await response.json()) as Record<string, unknown>;
    return {
      platform: link.platform,
      articleId: link.articleId,
      title: typeof article.title === "string" ? article.title : undefined,
      url: articleUrl(link.baseUrl, article) ?? link.url ?? undefined,
      published: typeof article.published === "boolean" ? article.published : link.published,
      views: typeof article.page_views_count === "number" ? article.page_views_count : undefined,
      likes: typeof article.positive_reactions_count === "number" ? article.positive_reactions_count : undefined,
      comments: typeof article.comments_count === "number" ? article.comments_count : undefined,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      platform: link.platform,
      articleId: link.articleId,
      url: link.url ?? undefined,
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function getMetrics(file: string): Promise<PostMetrics> {
  const metrics = await readAllMetrics();
  return metrics[file] ?? metricsForFile(file);
}

async function updateMetrics(file: string, event: PostMetricsEvent): Promise<PostMetrics> {
  const metrics = await readAllMetrics();
  const current = metrics[file] ?? metricsForFile(file);
  switch (event) {
    case "view":
      current.views += 1;
      break;
    case "like":
      current.likes += 1;
      break;
    case "bookmark":
      current.bookmarks += 1;
      break;
    case "share":
      current.shares += 1;
      break;
    case "comment":
      current.comments += 1;
      break;
  }
  current.updatedAt = new Date().toISOString();
  metrics[file] = current;
  await writeAllMetrics(metrics);
  return current;
}

async function syncMetricsToRemote(file: string, metrics: PostMetrics): Promise<{ synced: boolean; mode: string }> {
  const adapter = loadRemoteAdapterConfig();
  if (!adapter.baseUrl) {
    return { synced: false, mode: "local" };
  }

  const response = await fetch(new URL("/api/posts/metrics", adapter.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(adapter.token ? { authorization: `Bearer ${adapter.token}` } : {}),
    },
    body: JSON.stringify({ file, metrics }),
  });

  if (!response.ok) {
    throw new Error(`dev.io metrics sync failed: ${response.status} ${response.statusText}`);
  }

  return { synced: true, mode: "remote" };
}

const server = new McpServer({
  name: "dev-io",
  version: "0.1.0",
});

server.registerTool(
  "publish_post",
  {
    description: "Write a Markdown post locally and optionally publish it to DEV.to using the official Forem API",
    inputSchema: {
      title: z.string(),
      summary: z.string(),
      conversation: z.string().optional(),
      author: z.string().optional(),
      source: z.string().optional(),
      topic: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input: PublishPostInput) => {
    await ensurePostsDir();
    const fileName = `${slugify(input.title)}-${Date.now()}.md`;
    const filePath = path.join(postsDir, fileName);
    const body = renderPost(input);
    await fs.writeFile(filePath, body, "utf8");
    const remote = await publishPostToDevTo(fileName, input, body);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              file: filePath,
              title: input.title,
              remote,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "list_posts",
  {
    description: "List dev.io posts",
    inputSchema: {},
  },
  async () => {
    const posts = await listPostFiles();
    return {
      content: [{ type: "text", text: JSON.stringify({ posts }, null, 2) }],
    };
  },
);

server.registerTool(
  "read_post",
  {
    description: "Read a dev.io post",
    inputSchema: {
      file: z.string(),
    },
  },
  async ({ file }: { file: string }) => {
    await ensurePostsDir();
    const filePath = resolvePostPath(file);
    const text = await fs.readFile(filePath, "utf8");
    return {
      content: [{ type: "text", text }],
    };
  },
);

server.registerTool(
  "get_post_info",
  {
    description: "Get metrics and file info for a dev.io post",
    inputSchema: {
      file: z.string(),
    },
  },
  async ({ file }: { file: string }) => {
    await ensurePostsDir();
    const filePath = resolvePostPath(file);
    const stat = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const metrics = await getMetrics(fileName);
    const remote = await fetchRemoteArticleSnapshot(fileName);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              file: fileName,
              size: stat.size,
              createdAt: stat.birthtime.toISOString(),
              modifiedAt: stat.mtime.toISOString(),
              metrics,
              remote,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "record_post_event",
  {
    description: "Record a view, like, bookmark, share, or comment event",
    inputSchema: {
      file: z.string(),
      event: z.enum(["view", "like", "bookmark", "share", "comment"]),
    },
  },
  async ({ file, event }: { file: string; event: PostMetricsEvent }) => {
    await ensurePostsDir();
    const filePath = resolvePostPath(file);
    const fileName = path.basename(filePath);
    const metrics = await updateMetrics(fileName, event);
    const sync = await syncMetricsToRemote(fileName, metrics);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              file: fileName,
              event,
              metrics,
              sync,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerResource(
  "post_template",
  new ResourceTemplate("dev-io://post-template", { list: undefined }),
  {
    title: "dev.io post template",
    description: "Reusable Markdown structure for dev.io posts.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: [
          "---",
          "title: Your title",
          "author: dev.io",
          "source: ai-conversation",
          "topic: communication-result",
          "tags: [mcp, ai, dev-io]",
          "---",
          "",
          "## Summary",
          "",
          "Write the concise result here.",
          "",
          "## Conversation",
          "",
          "Optional transcript or excerpt.",
        ].join("\n"),
      },
    ],
  }),
);

server.registerResource(
  "post_index",
  new ResourceTemplate("dev-io://posts", { list: undefined }),
  {
    title: "dev.io post index",
    description: "List of published posts.",
    mimeType: "application/json",
  },
  async (uri) => {
    const posts = await listPostFiles();
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              posts,
              adapter: loadRemoteAdapterConfig().baseUrl ? "remote" : "local",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerResource(
  "post_metrics",
  new ResourceTemplate("dev-io://posts/metrics", { list: undefined }),
  {
    title: "dev.io post metrics",
    description: "Metrics snapshot for all posts.",
    mimeType: "application/json",
  },
  async (uri) => {
    const metrics = await readAllMetrics();
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(metrics, null, 2),
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transportMode = process.env.MCP_TRANSPORT ?? "stdio";

  if (transportMode === "http") {
    await runHttpServer();
    return;
  }

  if (transportMode !== "stdio") {
    throw new Error(`Unsupported MCP_TRANSPORT: ${transportMode}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("dev.io MCP server running on stdio");
}

async function runHttpServer(): Promise<void> {
  const host = process.env.MCP_HOST ?? "0.0.0.0";
  const port = Number.parseInt(process.env.MCP_PORT ?? process.env.PORT ?? "3000", 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid MCP_PORT: ${process.env.MCP_PORT ?? process.env.PORT}`);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const httpServer = createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === "/healthz" && request.method === "GET") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (requestUrl.pathname === "/readyz" && request.method === "GET") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: server.isConnected() ? "ready" : "starting" }));
      return;
    }

    if (requestUrl.pathname !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    try {
      await transport.handleRequest(request, response);
    } catch (error) {
      console.error("dev.io MCP HTTP request failed:", error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "internal_server_error" }));
      }
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.error(`dev.io MCP HTTP server received ${signal}`);
    await transport.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      console.error(`dev.io MCP server running on http://${host}:${port}/mcp`);
      resolve();
    });
  });
}

main().catch((error) => {
  console.error("dev-io MCP server failed to start:", error);
  process.exit(1);
});
