import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const postsDir = path.join(projectRoot, "posts");
const dataDir = path.join(projectRoot, "data");
const metricsFile = path.join(dataDir, "post-metrics.json");
const commentsFile = path.join(dataDir, "post-comments.json");

type PostMetrics = {
  views: number;
  likes: number;
  bookmarks: number;
  shares: number;
  comments: number;
  updatedAt: string;
};

type LocalPostSummary = {
  file: string;
  title: string;
  summary: string;
  author?: string;
  topic?: string;
  tags: string[];
};

type DevToArticle = {
  id: number | string;
  title: string;
  description?: string;
  url?: string;
  slug?: string;
  tags?: string[];
  published?: boolean;
  body_markdown?: string;
  created_at?: string;
  edited_at?: string;
  page_views_count?: number;
  positive_reactions_count?: number;
  comments_count?: number;
};

type StoredPostComment = {
  id: string;
  file: string;
  body: string;
  author: string;
  parentId: string | null;
  createdAt: string;
};

type PostCommentThread = StoredPostComment & {
  replies: PostCommentThread[];
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

type DevToConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string | null;
  userAgent: string;
};

function loadRemoteAdapterConfig(): RemoteDevIoAdapterConfig {
  return {
    baseUrl: process.env.DEV_IO_API_BASE_URL ?? null,
    token: process.env.DEV_IO_API_TOKEN ?? null,
  };
}

function loadDevToConfig(): DevToConfig {
  return {
    enabled: process.env.DEV_TO_PUBLISH === "true",
    baseUrl: process.env.DEV_TO_API_BASE_URL ?? "https://dev.to",
    apiKey: process.env.DEV_TO_API_KEY ?? null,
    userAgent: process.env.DEV_TO_USER_AGENT ?? "dev-io-mcp/0.2.0",
  };
}

function parseFrontMatterMarkdown(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const trimmed = text.trim();
  const match = trimmed.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    result[key] = value;
  }
  return result;
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

function renderRemotePost(input: PublishPostInput): string {
  const sections = [input.summary.trim()];

  if (input.conversation?.trim()) {
    sections.push(input.conversation.trim());
  }

  return sections.join("\n\n");
}

function sanitizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getWords(input: string): string[] {
  return sanitizeText(input).split(" ").filter(Boolean);
}

function summarizeText(input: string, maxWords = 80): string {
  const stripped = input.replace(/^---[\s\S]*?---\n/, "").trim().replace(/[#>*_`[\]]/g, "");
  const words = getWords(stripped);
  if (!words.length) return "";
  return words.slice(0, maxWords).join(" ");
}

function scoreSimilarity(a: string, b: string): number {
  const setA = new Set(getWords(a));
  const setB = new Set(getWords(b));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared++;
  return shared / Math.max(1, setA.size + setB.size - shared);
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

async function searchLocalPosts(query: string): Promise<LocalPostSummary[]> {
  const posts = await listPostFiles();
  const normalized = query.toLowerCase();
  const out: LocalPostSummary[] = [];

  for (const file of posts) {
    const filePath = resolvePostPath(file);
    const text = await fs.readFile(filePath, "utf8");
    if (!text.toLowerCase().includes(normalized)) continue;
    out.push(localSummaryFromContent(file, text));
  }

  return out;
}

function localSummaryFromContent(file: string, text: string): LocalPostSummary {
  const parsed = parseFrontMatterMarkdown(text);
  const title = parsed.title || file.replace(/\.md$/, "");
  const rawTags = parsed.tags ? parsed.tags.replace(/^\[/, "").replace(/\]$/, "") : "";
  return {
    file,
    title,
    summary: parsed.summary || summarizeText(text),
    author: parsed.author,
    topic: parsed.topic,
    tags: rawTags ? rawTags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
  };
}

async function loadRemoteArticles(limit = 100): Promise<DevToArticle[]> {
  const config = loadDevToConfig();
  if (!config.enabled) {
    throw new Error("DEV_TO_PUBLISH must be true to use DEV.to operations");
  }

  if (!config.apiKey) {
    throw new Error("DEV_TO_API_KEY is required for DEV.to operations");
  }

  const url = new URL("/api/articles/me", config.baseUrl);
  url.searchParams.set("per_page", String(Math.min(Math.max(limit, 1), 1000)));

  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.forem.api-v1+json",
      "user-agent": config.userAgent,
      "api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`DEV.to list failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) return [];

  return payload.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: typeof item.id === "number" || typeof item.id === "string" ? item.id : "unknown",
      title: typeof item.title === "string" ? item.title : "Untitled",
      description: typeof item.description === "string" ? item.description : undefined,
      url: typeof item.url === "string" ? item.url : undefined,
      slug: typeof item.slug === "string" ? item.slug : undefined,
      tags: Array.isArray(item.tag_list)
        ? item.tag_list.filter((tag): tag is string => typeof tag === "string")
        : [],
      published: typeof item.published === "boolean" ? item.published : false,
      body_markdown: typeof item.body_markdown === "string" ? item.body_markdown : undefined,
      created_at: typeof item.created_at === "string" ? item.created_at : undefined,
      edited_at: typeof item.edited_at === "string" ? item.edited_at : undefined,
      page_views_count: typeof item.page_views_count === "number" ? item.page_views_count : undefined,
      positive_reactions_count:
        typeof item.positive_reactions_count === "number" ? item.positive_reactions_count : undefined,
      comments_count: typeof item.comments_count === "number" ? item.comments_count : undefined,
    };
  });
}

async function loadRemoteArticle(articleId: number | string): Promise<DevToArticle> {
  const config = loadDevToConfig();
  if (!config.enabled) {
    throw new Error("DEV_TO_PUBLISH must be true to use DEV.to operations");
  }

  if (!config.apiKey) {
    throw new Error("DEV_TO_API_KEY is required for DEV.to operations");
  }

  const url = new URL(`/api/articles/${articleId}`, config.baseUrl);
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.forem.api-v1+json",
      "user-agent": config.userAgent,
      "api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`DEV.to read failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as DevToArticle;
  return payload;
}

async function writeLocalPost(file: string, text: string): Promise<void> {
  const filePath = resolvePostPath(file);
  await fs.writeFile(filePath, text, "utf8");
}

function mergeFrontMatter(text: string, patch: Record<string, string>): string {
  const match = text.match(/^---\n[\s\S]*?\n---/);
  if (!match) {
    return text;
  }

  const block = match[0];
  const head = block.replace(/^---|---$/g, "").trimEnd();
  const body = text.slice(match[0].length);
  const map = new Map<string, string>();
  for (const line of head.split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    map.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }

  for (const [key, value] of Object.entries(patch)) {
    map.set(key, value);
  }

  const next = [
    "---",
    ...Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`),
    "---",
    body.trimStart(),
  ].join("\n");
  return `${next}\n`;
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

async function readAllComments(): Promise<StoredPostComment[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(commentsFile, "utf8");
    const payload = JSON.parse(raw) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("post comments store must contain an array");
    }

    return payload.filter((item): item is StoredPostComment => {
      if (!item || typeof item !== "object") return false;
      const comment = item as Record<string, unknown>;
      return (
        typeof comment.id === "string" &&
        typeof comment.file === "string" &&
        typeof comment.body === "string" &&
        typeof comment.author === "string" &&
        (typeof comment.parentId === "string" || comment.parentId === null) &&
        typeof comment.createdAt === "string"
      );
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAllComments(comments: StoredPostComment[]): Promise<void> {
  await ensureDataDir();
  const temporaryFile = `${commentsFile}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(comments, null, 2), "utf8");
  await fs.rename(temporaryFile, commentsFile);
}

function buildCommentThreads(comments: StoredPostComment[]): PostCommentThread[] {
  const nodes = new Map<string, PostCommentThread>();
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const roots: PostCommentThread[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;
    const parent = comment.parentId ? nodes.get(comment.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function listLocalPostComments(file: string): Promise<PostCommentThread[]> {
  const filePath = resolvePostPath(file);
  await fs.stat(filePath);
  const fileName = path.basename(filePath);
  const comments = (await readAllComments()).filter((comment) => comment.file === fileName);
  return buildCommentThreads(comments);
}

async function addLocalPostComment(input: {
  file: string;
  body: string;
  author?: string;
  parentId?: string;
}): Promise<{ comment: StoredPostComment; metrics: PostMetrics }> {
  const filePath = resolvePostPath(input.file);
  await fs.stat(filePath);
  const fileName = path.basename(filePath);
  const body = input.body.trim();
  if (!body) throw new Error("comment body cannot be empty");

  const comments = await readAllComments();
  if (input.parentId) {
    const parent = comments.find((comment) => comment.id === input.parentId);
    if (!parent || parent.file !== fileName) {
      throw new Error(`Comment ${input.parentId} does not belong to ${fileName}`);
    }
  }

  const comment: StoredPostComment = {
    id: randomUUID(),
    file: fileName,
    body,
    author: input.author?.trim() || "dev.io",
    parentId: input.parentId ?? null,
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  await writeAllComments(comments);
  const metrics = await updateMetrics(fileName, "comment");
  return { comment, metrics };
}

async function loadRemotePostComments(
  articleId: string | number,
  page?: number,
  perPage = 50,
): Promise<unknown[]> {
  const config = loadDevToConfig();
  const url = new URL("/api/comments", config.baseUrl);
  url.searchParams.set("a_id", String(articleId));
  url.searchParams.set("per_page", String(perPage));
  if (page) url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.forem.api-v1+json",
      "user-agent": config.userAgent,
      ...(config.apiKey ? { "api-key": config.apiKey } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`DEV.to comments list failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("DEV.to comments response was not an array");
  }
  return payload;
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

async function deleteLocalPost(file: string): Promise<string> {
  const filePath = resolvePostPath(file);
  const fileName = path.basename(filePath);
  await fs.unlink(filePath);

  const metrics = await readAllMetrics();
  if (metrics[fileName]) {
    delete metrics[fileName];
    await writeAllMetrics(metrics);
  }

  const comments = await readAllComments();
  const remainingComments = comments.filter((comment) => comment.file !== fileName);
  if (remainingComments.length !== comments.length) {
    await writeAllComments(remainingComments);
  }
  return fileName;
}

async function publishPostToDevTo(
  input: PublishPostInput,
): Promise<{ published: boolean; mode: string; articleId?: number | string; url?: string | null }> {
  const config = loadDevToConfig();
  if (!config.enabled) {
    return { published: false, mode: "local" };
  }

  if (!config.apiKey) {
    throw new Error("DEV_TO_API_KEY is required when DEV_TO_PUBLISH=true");
  }

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
        body_markdown: renderRemotePost(input),
        published: true,
        description: input.summary.trim().slice(0, 160),
        tags: (input.tags?.length ? input.tags : ["mcp", "ai", "dev-io"]).slice(0, 4),
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const detail = raw.replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`DEV.to publish failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const articleId = payload.id;
  if (typeof articleId !== "number" && typeof articleId !== "string") {
    throw new Error("DEV.to publish response did not include an article id");
  }
  const url = typeof payload.url === "string" ? payload.url : null;

  return { published: true, mode: "dev.to", articleId, url };
}

async function updateRemotePost(articleId: number | string, updates: { title?: string; summary?: string; tags?: string[] }): Promise<{
  ok: boolean;
  articleId: number | string;
}> {
  const config = loadDevToConfig();
  if (!config.enabled || !config.apiKey) {
    throw new Error("DEV_TO publish mode and API key are required for remote update");
  }

  const response = await fetch(new URL(`/api/articles/${articleId}`, config.baseUrl), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      accept: "application/vnd.forem.api-v1+json",
      "api-key": config.apiKey,
      "user-agent": config.userAgent,
    },
    body: JSON.stringify({
      article: {
        ...(updates.title ? { title: updates.title } : {}),
        ...(updates.summary ? { body_markdown: updates.summary } : {}),
        ...(updates.tags ? { tags: updates.tags } : {}),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`DEV.to update failed: ${response.status} ${response.statusText}`);
  }

  return { ok: true, articleId };
}

async function deleteRemotePost(articleId: number | string): Promise<void> {
  const config = loadDevToConfig();
  if (!config.enabled || !config.apiKey) {
    throw new Error("DEV_TO publish mode and API key are required for remote delete");
  }

  const response = await fetch(new URL(`/api/articles/${articleId}`, config.baseUrl), {
    method: "DELETE",
    headers: {
      accept: "application/vnd.forem.api-v1+json",
      "api-key": config.apiKey,
      "user-agent": config.userAgent,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`DEV.to delete failed: ${response.status} ${response.statusText}`);
  }
}

function createMcpServer(): McpServer {
const server = new McpServer({
  name: "dev-io",
  version: "0.2.0",
});

server.registerTool(
  "publish_post",
  {
    description: "Publish a dev.io Markdown post",
    inputSchema: {
      title: z.string(),
      summary: z.string(),
      conversation: z.string().optional(),
      author: z.string().optional(),
      source: z.string().optional(),
      topic: z.string().optional(),
      tags: z.array(z.string()).optional(),
      publish_to_remote: z.boolean().optional(),
    },
  },
  async (input: PublishPostInput) => {
    await ensurePostsDir();
    const fileName = `${slugify(input.title)}-${Date.now()}.md`;
    const filePath = path.join(postsDir, fileName);
    const body = renderPost(input);
    await fs.writeFile(filePath, body, "utf8");
    const publishToRemote = (input as PublishPostInput & { publish_to_remote?: boolean }).publish_to_remote ?? false;
    const remote = publishToRemote ? await publishPostToDevTo(input) : { published: false, mode: "local" };

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
    inputSchema: {
      source: z.enum(["local", "remote", "both"]).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      query: z.string().optional(),
    },
  },
  async ({
    source = "both",
    limit = 20,
    query,
  }: {
    source?: "local" | "remote" | "both";
    limit?: number;
    query?: string;
  }) => {
    const out: {
      source: "local" | "remote";
      posts: Array<{
        file?: string;
        title: string;
        summary?: string;
        tags?: string[];
        url?: string;
        id?: string | number;
        views?: number;
        likes?: number;
        comments?: number;
      }>;
    }[] = [];

    const normalized = query?.trim();

    if (source === "local" || source === "both") {
      const local = await listPostFiles();
      const selected = normalized
        ? local.filter((file) => file.toLowerCase().includes(normalized.toLowerCase()))
        : local;
      const posts = [];
      for (const file of selected.slice(0, limit)) {
        const text = await fs.readFile(resolvePostPath(file), "utf8");
        posts.push(localSummaryFromContent(file, text));
      }
      out.push({ source: "local", posts });
    }

    if (source === "remote" || source === "both") {
      const remoteArticles = await loadRemoteArticles(limit);
      const remotePosts = remoteArticles
        .filter((article) =>
          !normalized
            ? true
            : [article.title, article.description, article.slug]
                .filter(Boolean)
                .map(String)
                .some((value) => value.toLowerCase().includes(normalized.toLowerCase())),
        )
        .slice(0, limit);
      out.push({
        source: "remote",
        posts: remotePosts.map((article) => ({
          id: article.id,
          title: article.title,
          summary: article.description,
          tags: article.tags,
          url: article.url,
          views: article.page_views_count,
          likes: article.positive_reactions_count,
          comments: article.comments_count,
        })),
      });
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ results: out, mode: source }, null, 2) }],
    };
  },
);

server.registerTool(
  "list_post_comments",
  {
    description: "List threaded comments for a local Markdown post or a remote DEV.to article",
    inputSchema: {
      source: z.enum(["local", "remote"]),
      file: z.string().optional(),
      article_id: z.union([z.string(), z.number()]).optional(),
      page: z.number().int().min(1).optional(),
      per_page: z.number().int().min(1).max(1000).optional(),
    },
  },
  async ({
    source,
    file,
    article_id,
    page,
    per_page = 50,
  }: {
    source: "local" | "remote";
    file?: string;
    article_id?: string | number;
    page?: number;
    per_page?: number;
  }) => {
    if (source === "local") {
      if (!file) throw new Error("file is required for local comment listing");
      const comments = await listLocalPostComments(file);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { source, file: path.basename(resolvePostPath(file)), comments },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (typeof article_id === "undefined") {
      throw new Error("article_id is required for remote comment listing");
    }
    const comments = await loadRemotePostComments(article_id, page, per_page);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ source, article_id, page: page ?? null, per_page, comments }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "add_post_comment",
  {
    description: "Add a top-level comment to a local Markdown post",
    inputSchema: {
      file: z.string(),
      body: z.string().min(1).max(10_000),
      author: z.string().min(1).max(100).optional(),
    },
  },
  async ({ file, body, author }: { file: string; body: string; author?: string }) => {
    const result = await addLocalPostComment({ file, body, author });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, source: "local", ...result }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "reply_post_comment",
  {
    description: "Reply to an existing comment on a local Markdown post",
    inputSchema: {
      file: z.string(),
      comment_id: z.string().uuid(),
      body: z.string().min(1).max(10_000),
      author: z.string().min(1).max(100).optional(),
    },
  },
  async ({
    file,
    comment_id,
    body,
    author,
  }: {
    file: string;
    comment_id: string;
    body: string;
    author?: string;
  }) => {
    const result = await addLocalPostComment({ file, body, author, parentId: comment_id });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, source: "local", ...result }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "search_post",
  {
    description: "Search posts by keyword across local markdown and remote DEV.to articles",
    inputSchema: {
      query: z.string(),
      source: z.enum(["local", "remote", "both"]).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
  },
  async ({
    query,
    source = "both",
    limit = 50,
  }: {
    query: string;
    source?: "local" | "remote" | "both";
    limit?: number;
  }) => {
    const result: Array<{ source: "local"; file: string; score: number } | { source: "remote"; id: string | number; score: number }> = [];

    if (source === "local" || source === "both") {
      const local = await searchLocalPosts(query);
      const scored = local
        .map((summary) => ({
          source: "local" as const,
          file: summary.file,
          score: scoreSimilarity(`${summary.title} ${summary.summary} ${summary.tags.join(" ")}`, query),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      result.push(...scored);
    }

    if (source === "remote" || source === "both") {
      const remote = await loadRemoteArticles(limit);
      const scoredRemote = remote
        .map((article) => ({
          source: "remote" as const,
          id: article.id,
          score: scoreSimilarity(`${article.title} ${article.description ?? ""} ${(article.tags ?? []).join(" ")}`, query),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      result.push(...scoredRemote);
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ query, matches: result }, null, 2) }],
    };
  },
);

server.registerTool(
  "summarize_post",
  {
    description: "Summarize a local or remote post",
    inputSchema: {
      source: z.enum(["local", "remote"]),
      file: z.string().optional(),
      article_id: z.union([z.string(), z.number()]).optional(),
      max_words: z.number().int().min(20).max(500).optional(),
    },
  },
  async ({
    source,
    file,
    article_id,
    max_words = 120,
  }: {
    source: "local" | "remote";
    file?: string;
    article_id?: string | number;
    max_words?: number;
  }) => {
    if (source === "local") {
      if (!file) throw new Error("file is required for local summaries");
      const text = await fs.readFile(resolvePostPath(file), "utf8");
      const parsed = parseFrontMatterMarkdown(text);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "local",
                file: path.basename(resolvePostPath(file)),
                title: parsed.title ?? file,
                summary: summarizeText(text, max_words),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (typeof article_id === "undefined") {
      throw new Error("article_id is required for remote summaries");
    }
    const article = await loadRemoteArticle(article_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              source: "remote",
              article_id: article.id,
              title: article.title,
              summary: summarizeText(article.body_markdown ?? "", max_words),
              url: article.url,
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
  "find_related_posts",
  {
    description: "Find related local posts based on title/summary/topic against a prompt",
    inputSchema: {
      source: z.enum(["local", "remote"]).optional(),
      file: z.string().optional(),
      article_id: z.union([z.string(), z.number()]).optional(),
      prompt: z.string(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async ({
    source = "local",
    file,
    article_id,
    prompt,
    limit = 20,
  }: {
    source?: "local" | "remote";
    file?: string;
    article_id?: string | number;
    prompt: string;
    limit?: number;
  }) => {
    if (source === "local") {
      if (!file) throw new Error("file is required for local related-post search");
      const sourceText = await fs.readFile(resolvePostPath(file), "utf8");
      const items = await Promise.all(
        (await listPostFiles())
          .filter((name) => name !== path.basename(file))
          .map(async (name) => {
            const text = await fs.readFile(resolvePostPath(name), "utf8");
            const parsed = localSummaryFromContent(name, text);
            const score = scoreSimilarity(`${parsed.title} ${parsed.summary} ${parsed.topic ?? ""} ${parsed.tags.join(" ")}`, `${prompt} ${sourceText}`);
            return { file: name, title: parsed.title, score };
          }),
      );
      const related = items.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify({ source: "local", prompt, related }, null, 2) }] };
    }

    if (!article_id) throw new Error("article_id is required for remote related-post search");
    const sourceArticle = await loadRemoteArticle(article_id);
    const articles = await loadRemoteArticles(limit);
    const related = articles
      .filter((article) => article.id !== article_id)
      .map((article) => ({
        id: article.id,
        title: article.title,
        score: scoreSimilarity(`${article.title} ${article.description ?? ""}`, `${prompt} ${sourceArticle.title}`),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return {
      content: [{ type: "text", text: JSON.stringify({ source: "remote", prompt, related }, null, 2) }],
    };
  },
);

server.registerTool(
  "compare_posts",
  {
    description: "Compare two local posts or two remote articles",
    inputSchema: {
      source: z.enum(["local", "remote"]),
      file_a: z.string(),
      file_b: z.string().optional(),
      article_a: z.union([z.string(), z.number()]).optional(),
      article_b: z.union([z.string(), z.number()]).optional(),
    },
  },
  async ({
    source,
    file_a,
    file_b,
    article_a,
    article_b,
  }: {
    source: "local" | "remote";
    file_a: string;
    file_b?: string;
    article_a?: string | number;
    article_b?: string | number;
  }) => {
    if (source === "local") {
      if (!file_b) throw new Error("file_b is required for local comparison");
      const [first, second] = await Promise.all([
        fs.readFile(resolvePostPath(file_a), "utf8"),
        fs.readFile(resolvePostPath(file_b), "utf8"),
      ]);
      const a = localSummaryFromContent(file_a, first);
      const b = localSummaryFromContent(file_b, second);
      const similarity = scoreSimilarity(`${a.title} ${a.summary} ${a.tags.join(" ")}`, `${b.title} ${b.summary} ${b.tags.join(" ")}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "local",
                file_a: a.file,
                file_b: b.file,
                metrics: {
                  similarity,
                  sharedTags: a.tags.filter((tag) => b.tags.includes(tag)),
                  tagsA: a.tags.length,
                  tagsB: b.tags.length,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (!article_a || !article_b) {
      throw new Error("article_a and article_b are required for remote comparison");
    }
    const [a, b] = await Promise.all([loadRemoteArticle(article_a), loadRemoteArticle(article_b)]);
    const combined = `${a.title} ${a.description ?? ""} ${(a.tags ?? []).join(" ")}`;
    const compareWith = `${b.title} ${b.description ?? ""} ${(b.tags ?? []).join(" ")}`;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              source: "remote",
              article_a: a.id,
              article_b: b.id,
              metrics: {
                similarity: scoreSimilarity(combined, compareWith),
                sharedTags: (a.tags ?? []).filter((tag) => (b.tags ?? []).includes(tag)),
              },
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
  "update_post",
  {
    description: "Update local markdown metadata/body or remote DEV.to article",
    inputSchema: {
      source: z.enum(["local", "remote"]),
      file: z.string().optional(),
      article_id: z.union([z.string(), z.number()]).optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      published: z.boolean().optional(),
    },
  },
  async ({
    source,
    file,
    article_id,
    title,
    summary,
    tags,
  }: {
    source: "local" | "remote";
    file?: string;
    article_id?: string | number;
    title?: string;
    summary?: string;
    tags?: string[];
    published?: boolean;
  }) => {
    if (source === "local") {
      if (!file) throw new Error("file is required for local update");
      const current = await fs.readFile(resolvePostPath(file), "utf8");
      const updated = mergeFrontMatter(current, {
        ...(title ? { title } : {}),
        ...(summary ? { summary } : {}),
        ...(tags ? { tags: `[${tags.join(", ")}]` } : {}),
      });
      await writeLocalPost(file, updated);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, file: path.basename(resolvePostPath(file)), source: "local" }, null, 2) }],
      };
    }

    if (!article_id) throw new Error("article_id is required for remote update");
    const updates: { title?: string; summary?: string; tags?: string[] } = {};
    if (title) updates.title = title;
    if (summary) updates.summary = summary;
    if (tags) updates.tags = tags;

    const result = await updateRemotePost(article_id, updates);
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, source: "remote", ...(result as { ok?: boolean; articleId: string | number }) }, null, 2) }],
    };
  },
);

server.registerTool(
  "delete_post",
  {
    description: "Delete local markdown or remote DEV.to article",
    inputSchema: {
      source: z.enum(["local", "remote"]),
      file: z.string().optional(),
      article_id: z.union([z.string(), z.number()]).optional(),
    },
  },
  async ({
    source,
    file,
    article_id,
  }: {
    source: "local" | "remote";
    file?: string;
    article_id?: string | number;
  }) => {
    if (source === "local") {
      if (!file) throw new Error("file is required for local delete");
      const removed = await deleteLocalPost(file);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, source: "local", file: removed }, null, 2) }],
      };
    }

    if (!article_id) throw new Error("article_id is required for remote delete");
    await deleteRemotePost(article_id);
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, source: "remote", article_id }, null, 2) }],
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
    const metrics = await getMetrics(path.basename(filePath));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              file: path.basename(filePath),
              size: stat.size,
              createdAt: stat.birthtime.toISOString(),
              modifiedAt: stat.mtime.toISOString(),
              metrics,
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

return server;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main(): Promise<void> {
  const host = process.env.MCP_HOST ?? "0.0.0.0";
  const port = Number.parseInt(process.env.MCP_PORT ?? process.env.PORT ?? "3000", 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid MCP_PORT: ${process.env.MCP_PORT ?? process.env.PORT}`);
  }

  const sessions = new Map<
    string,
    { server: McpServer; transport: StreamableHTTPServerTransport }
  >();

  const httpServer = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/readyz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ready" }));
      return;
    }

    if (requestUrl.pathname !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    try {
      const parsedBody = request.method === "POST" ? await readJsonBody(request) : undefined;
      const sessionId = request.headers["mcp-session-id"];
      const session = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;

      if (session) {
        await session.transport.handleRequest(request, response, parsedBody);
        return;
      }

      if (request.method !== "POST" || !isInitializeRequest(parsedBody)) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: a valid MCP session is required",
            },
            id: null,
          }),
        );
        return;
      }

      const mcpServer = createMcpServer();
      let transport: StreamableHTTPServerTransport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          sessions.set(initializedSessionId, { server: mcpServer, transport });
        },
      });
      transport.onclose = () => {
        const initializedSessionId = transport.sessionId;
        if (initializedSessionId) {
          sessions.delete(initializedSessionId);
        }
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(request, response, parsedBody);
    } catch (error) {
      console.error("dev.io MCP HTTP request failed:", error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "internal_server_error" }));
      }
    }
  });

  httpServer.listen(port, host, () => {
    console.error(`dev.io MCP server running on http://${host}:${port}/mcp`);
  });
}

main().catch((error) => {
  console.error("dev-io MCP server failed to start:", error);
  process.exit(1);
});
