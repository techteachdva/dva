const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { globSync } = require("glob");
const slugify = require("@sindresorhus/slugify");
const siteGraphConfig = require("./siteGraphLinks");

const wikiLinkRegex = /\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g;
const internalLinkRegex = /href="(\/[^"#?]*)/g;
const externalSiteLinkRegex = /href="(https?:\/\/[^"]+)"/g;
const bareUrlRegex = /https?:\/\/[^\s<)"']+/g;

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return null;
  let value = url.trim().replace(/\\/g, "");
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./, "");
      if (host === "dva-nu.vercel.app" || host.endsWith(".vercel.app")) {
        value = parsed.pathname;
      } else {
        return null;
      }
    }
  } catch {
    return null;
  }
  if (!value.startsWith("/")) value = `/${value}`;
  if (value !== "/" && !value.endsWith("/")) value = `${value}/`;
  return value;
}

function cleanWikiTarget(raw) {
  return (raw || "")
    .replace(/\\+/g, "")
    .replace(/\.(md|markdown)$/i, "")
    .trim()
    .split("#")[0];
}

function extractLinks(content) {
  const str = content && typeof content === "string" ? content : "";
  const links = [];

  let match;
  const wikiRegex = new RegExp(wikiLinkRegex.source, wikiLinkRegex.flags);
  while ((match = wikiRegex.exec(str)) !== null) {
    links.push(cleanWikiTarget(match[1]));
  }

  const hrefRegex = new RegExp(internalLinkRegex.source, internalLinkRegex.flags);
  while ((match = hrefRegex.exec(str)) !== null) {
    links.push(match[1]);
  }

  const extRegex = new RegExp(externalSiteLinkRegex.source, externalSiteLinkRegex.flags);
  while ((match = extRegex.exec(str)) !== null) {
    links.push(match[1]);
  }

  const bareRegex = new RegExp(bareUrlRegex.source, bareUrlRegex.flags);
  while ((match = bareRegex.exec(str)) !== null) {
    links.push(match[0]);
  }

  return links;
}

function resolveNoteFile(fileName) {
  const startPath = "./src/site/notes/";
  let name = (fileName || "").replaceAll("&amp;", "&").trim();
  if (!name) return null;

  let header = "";
  if (name.includes("#")) {
    [name, header] = name.split("#");
  }

  const candidates = globSync(`${startPath}**/${name}`, { nodir: true });
  let fullPath = candidates[0];
  if (!fullPath && !name.endsWith(".md")) {
    const mdCandidates = globSync(`${startPath}**/${name}.md`, { nodir: true });
    fullPath = mdCandidates[0];
  }
  if (!fullPath) return null;

  const file = fs.readFileSync(fullPath, "utf8");
  const frontMatter = matter(file);
  let permalink = `/notes/${slugify(name)}/`;
  if (frontMatter.data.permalink) {
    permalink = frontMatter.data.permalink;
  }
  if (
    frontMatter.data.tags &&
    frontMatter.data.tags.indexOf("gardenEntry") !== -1
  ) {
    permalink = "/";
  }

  return {
    url: normalizeUrl(permalink),
    title: frontMatter.data.title || path.basename(name, ".md"),
    noteIcon: frontMatter.data.noteIcon || process.env.NOTE_ICON_DEFAULT || "",
    hide: Boolean(frontMatter.data.hideInGraph),
    group: path.dirname(fullPath).split(path.sep).pop() || "none",
    filePath: fullPath,
  };
}

function buildPageIndex(notes) {
  const urlToMeta = {};
  const lookup = {};

  function register(url, meta) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    if (!urlToMeta[normalized]) {
      urlToMeta[normalized] = meta;
    }
    lookup[normalized] = normalized;
    lookup[normalized.slice(1, -1)] = normalized;
    lookup[normalized.slice(1)] = normalized;
    if (meta.title) {
      lookup[meta.title.toLowerCase()] = normalized;
    }
  }

  function registerAliases(rawKey, url) {
    if (!rawKey) return;
    const key = rawKey.replace(/\\+/g, "").trim();
    const normalized = normalizeUrl(url);
    lookup[key] = normalized;
    lookup[key.toLowerCase()] = normalized;
    lookup[key.split("/").pop()] = normalized;
    lookup[key.split("/").pop().toLowerCase()] = normalized;
    lookup[path.basename(key, ".md")] = normalized;
    lookup[path.basename(key, ".md").toLowerCase()] = normalized;
  }

  for (const note of notes) {
    const stem = note.filePathStem.replace(/^.*?notes[/\\]/, "");
    const parts = stem.split(/[/\\]/);
    const group = parts.length >= 2 ? parts[parts.length - 2] : "none";
    const meta = {
      url: normalizeUrl(note.url),
      title: note.data.title || note.fileSlug,
      noteIcon: note.data.noteIcon || process.env.NOTE_ICON_DEFAULT || "",
      hide: Boolean(note.data.hideInGraph),
      group,
      home:
        Boolean(note.data["dg-home"]) ||
        (note.data.tags && note.data.tags.indexOf("gardenEntry") > -1),
    };
    register(meta.url, meta);
    registerAliases(stem, meta.url);
    registerAliases(note.fileSlug, meta.url);
  }

  const standaloneFiles = globSync("src/site/**/index.njk", {
    nodir: true,
    ignore: ["**/src/site/_includes/**"],
  });

  for (const file of standaloneFiles) {
    const raw = fs.readFileSync(file, "utf8");
    const fm = matter(raw);
    if (!fm.data.permalink) continue;
    const parts = file.replace(/\\/g, "/").split("/");
    const group = parts.length >= 3 ? parts[parts.length - 2] : "apps";
    const meta = {
      url: normalizeUrl(fm.data.permalink),
      title: fm.data.title || parts[parts.length - 2],
      noteIcon: fm.data.noteIcon || process.env.NOTE_ICON_DEFAULT || "",
      hide: Boolean(fm.data.hideInGraph),
      group,
      home: false,
    };
    if (!urlToMeta[meta.url]) {
      register(meta.url, meta);
    }
    registerAliases(parts[parts.length - 2], meta.url);
  }

  for (const app of siteGraphConfig.passthroughApps || []) {
    const meta = {
      url: normalizeUrl(app.url),
      title: app.title,
      noteIcon: process.env.NOTE_ICON_DEFAULT || "",
      hide: false,
      group: app.group || "Games",
      home: false,
    };
    if (!urlToMeta[meta.url]) register(meta.url, meta);
  }

  return { urlToMeta, lookup };
}

function resolveLinkTarget(linkRef, pageIndex) {
  const cleaned = cleanWikiTarget(linkRef);
  if (!cleaned) return null;

  const asUrl = normalizeUrl(cleaned);
  if (asUrl && pageIndex.urlToMeta[asUrl]) return asUrl;

  const keys = [
    cleaned,
    cleaned.toLowerCase(),
    cleaned.split("/").pop(),
    cleaned.split("/").pop().toLowerCase(),
  ];

  for (const key of keys) {
    if (pageIndex.lookup[key]) return pageIndex.lookup[key];
  }

  const resolved = resolveNoteFile(cleaned);
  if (resolved?.url) return resolved.url;
  return null;
}

async function getGraph(data) {
  const notes = data.collections.note || [];
  const pageIndex = buildPageIndex(notes);
  const nodes = {};
  const links = [];
  let homeAlias = "/";
  let nodeId = 0;

  for (const note of notes) {
    const raw = await note.template.read();
    const content = typeof raw === "string" ? raw : raw ? String(raw) : "";
    const meta = pageIndex.urlToMeta[normalizeUrl(note.url)];
    const url = meta?.url || normalizeUrl(note.url);

    nodes[url] = {
      id: nodeId++,
      title: meta?.title || note.data.title || note.fileSlug,
      url,
      group: meta?.group || "none",
      home: meta?.home || false,
      outBound: [],
      neighbors: [],
      backLinks: [],
      noteIcon: meta?.noteIcon || "",
      hide: meta?.hide || false,
    };

    if (nodes[url].home) homeAlias = url;
  }

  for (const [url, meta] of Object.entries(pageIndex.urlToMeta)) {
    if (nodes[url]) continue;
    nodes[url] = {
      id: nodeId++,
      title: meta.title,
      url,
      group: meta.group || "apps",
      home: false,
      outBound: [],
      neighbors: [],
      backLinks: [],
      noteIcon: meta.noteIcon || "",
      hide: meta.hide || false,
    };
  }

  for (const note of notes) {
    const raw = await note.template.read();
    const content = typeof raw === "string" ? raw : raw ? String(raw) : "";
    const sourceUrl = pageIndex.urlToMeta[normalizeUrl(note.url)]?.url || normalizeUrl(note.url);
    const outbound = new Set();

    for (const linkRef of extractLinks(content)) {
      const targetUrl = resolveLinkTarget(linkRef, pageIndex);
      if (targetUrl && targetUrl !== sourceUrl) {
        outbound.add(targetUrl);
      }
    }

    if (!nodes[sourceUrl]) continue;
    nodes[sourceUrl].outBound = Array.from(outbound);
  }

  const standaloneFiles = globSync("src/site/**/index.njk", {
    nodir: true,
    ignore: ["**/src/site/_includes/**"],
  });

  for (const file of standaloneFiles) {
    const raw = fs.readFileSync(file, "utf8");
    const fm = matter(raw);
    if (!fm.data.permalink) continue;
    const sourceUrl = normalizeUrl(fm.data.permalink);
    if (!nodes[sourceUrl]) continue;
    const outbound = new Set(nodes[sourceUrl].outBound || []);
    for (const linkRef of extractLinks(raw)) {
      const targetUrl = resolveLinkTarget(linkRef, pageIndex);
      if (targetUrl && targetUrl !== sourceUrl) outbound.add(targetUrl);
    }
    nodes[sourceUrl].outBound = Array.from(outbound);
  }

  for (const node of Object.values(nodes)) {
    node.neighbors = [];
    node.backLinks = [];
  }

  for (const node of Object.values(nodes)) {
    for (const targetUrl of node.outBound) {
      const target = nodes[targetUrl];
      if (!target) continue;
      links.push({ source: node.id, target: target.id });
      if (!node.neighbors.includes(targetUrl)) node.neighbors.push(targetUrl);
      if (!target.neighbors.includes(node.url)) target.neighbors.push(node.url);
      if (!target.backLinks.includes(node.url)) target.backLinks.push(node.url);
    }
    node.size = node.neighbors.length;
  }

  for (const [fromUrl, toUrl] of siteGraphConfig) {
    const from = nodes[normalizeUrl(fromUrl)];
    const to = nodes[normalizeUrl(toUrl)];
    if (!from || !to || from.url === to.url) continue;
    links.push({ source: from.id, target: to.id });
    links.push({ source: to.id, target: from.id });
    if (!from.neighbors.includes(to.url)) from.neighbors.push(to.url);
    if (!to.neighbors.includes(from.url)) to.neighbors.push(from.url);
    if (!from.outBound.includes(to.url)) from.outBound.push(to.url);
    if (!to.outBound.includes(from.url)) to.outBound.push(from.url);
    if (!to.backLinks.includes(from.url)) to.backLinks.push(from.url);
    if (!from.backLinks.includes(to.url)) from.backLinks.push(to.url);
    from.size = from.neighbors.length;
    to.size = to.neighbors.length;
  }

  return { homeAlias, nodes, links };
}

exports.wikiLinkRegex = wikiLinkRegex;
exports.internalLinkRegex = internalLinkRegex;
exports.extractLinks = extractLinks;
exports.getGraph = getGraph;
exports.normalizeUrl = normalizeUrl;
exports.resolveNoteFile = resolveNoteFile;
exports.buildPageIndex = buildPageIndex;
