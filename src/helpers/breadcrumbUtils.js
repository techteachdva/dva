function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "/";
  let path = url.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path !== "/" && !path.endsWith("/")) path = `${path}/`;
  return path;
}

function buildSectionIndex(notes) {
  const sectionByFolder = {};
  for (const note of notes) {
    const stem = (note.filePathStem || "").replace(/^.*?notes[/\\]/, "");
    const parts = stem.split(/[/\\]/);
    if (parts.length < 2) continue;
    const folder = parts[parts.length - 2];
    const slug = (note.fileSlug || "").toLowerCase();
    const folderKey = folder.toLowerCase();
    if (
      slug === folderKey ||
      slug === folderKey.replace(/\s+/g, "-") ||
      slug === folderKey.replace(/\s+/g, "_")
    ) {
      sectionByFolder[folderKey] = normalizeUrl(note.url);
    }
  }
  return sectionByFolder;
}

function getBreadcrumbs(pageData, options = {}) {
  const siteName = options.siteName || "Digital Garden";
  const sectionIndex = options.sectionIndex || {};
  const url = normalizeUrl(pageData.page?.url || pageData.permalink || "/");
  const isHome =
    url === "/" ||
    (pageData.tags && pageData.tags.indexOf("gardenEntry") > -1);

  if (isHome) {
    return [{ title: siteName, url: null }];
  }

  const crumbs = [{ title: siteName, url: "/" }];
  const dgPath = pageData["dg-path"];
  let folders = [];

  if (dgPath && typeof dgPath === "string") {
    folders = dgPath.split("/").filter(Boolean);
  } else {
    const stem = (pageData.page?.filePathStem || "").replace(/^.*?notes[/\\]/, "");
    const parts = stem.split(/[/\\]/).filter(Boolean);
    if (parts.length > 1) {
      folders = parts.slice(0, -1);
    }
  }

  for (const folder of folders) {
    const sectionUrl = sectionIndex[folder.toLowerCase()] || null;
    crumbs.push({
      title: folder,
      url: sectionUrl,
    });
  }

  const pageTitle =
    pageData.title ||
    pageData.page?.fileSlug ||
    pageData.page?.data?.title ||
    "Page";
  crumbs.push({ title: pageTitle, url: null });
  return crumbs;
}

module.exports = {
  normalizeUrl,
  buildSectionIndex,
  getBreadcrumbs,
};
