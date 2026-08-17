require("dotenv").config();
const { getBreadcrumbs, buildSectionIndex, normalizeUrl } = require("../../helpers/breadcrumbUtils");
const siteBreadcrumbs = require("./_data/siteBreadcrumbs");

module.exports = {
  eleventyComputed: {
    breadcrumbs: (data) => {
      const notes = data.collections?.note || [];
      const url = normalizeUrl(data.page?.url || data.permalink || "/");
      const siteName = process.env.SITE_NAME_HEADER || "Digital Garden";

      if (siteBreadcrumbs[url]) {
        return [{ title: siteName, url: "/" }, ...siteBreadcrumbs[url]];
      }

      return getBreadcrumbs(data, {
        siteName,
        sectionIndex: buildSectionIndex(notes),
      });
    },
  },
};
