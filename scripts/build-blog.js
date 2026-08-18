const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_BLOG = path.join(ROOT, "blog");
const OUTPUT = path.join(ROOT, "_site");
const OUTPUT_BLOG = path.join(OUTPUT, "blog");

const SITE_URL = "https://abundantlife.land";

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const item of fs.readdirSync(source, { withFileTypes: true })) {
    if (
      item.name === ".git" ||
      item.name === "_site" ||
      item.name === ".github"
    ) {
      continue;
    }

    const sourcePath = path.join(source, item.name);
    const destinationPath = path.join(destination, item.name);

    if (item.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function getMeta(html, name) {
  const regex = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']\\s*\\/?>`,
    "i"
  );

  const match = html.match(regex);

  return match ? match[1].trim() : "";
}

function getArticleFiles() {
  return fs
    .readdirSync(SOURCE_BLOG)
    .filter((file) => {
      return (
        file.endsWith(".html") &&
        file !== "index.html" &&
        !file.startsWith("_")
      );
    });
}

function readPosts() {
  const required = [
    "article:title",
    "article:description",
    "article:date",
    "article:category",
    "article:location",
    "article:image"
  ];

  const posts = [];

  for (const file of getArticleFiles()) {
    const fullPath = path.join(SOURCE_BLOG, file);
    const html = fs.readFileSync(fullPath, "utf8");

    const data = {};

    for (const field of required) {
      data[field] = getMeta(html, field);
    }

    const missing = required.filter((field) => !data[field]);

    if (missing.length > 0) {
      console.error(`\nMissing metadata in blog/${file}:`);

      for (const field of missing) {
        console.error(`  - ${field}`);
      }

      process.exitCode = 1;
      continue;
    }

    posts.push({
      title: data["article:title"],
      description: data["article:description"],
      date: data["article:date"],
      category: data["article:category"],
      location: data["article:location"],
      image: data["article:image"],
      url: `/blog/${file}`
    });
  }

  return posts.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
}

function writePostsJson(posts) {
  fs.mkdirSync(OUTPUT_BLOG, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_BLOG, "posts.json"),
    JSON.stringify(posts, null, 2)
  );
}

function writeSitemap(posts) {
  const urls = [
    {
      loc: `${SITE_URL}/`
    },
    {
      loc: `${SITE_URL}/blog/`
    },
    ...posts.map((post) => ({
      loc: `${SITE_URL}${post.url}`,
      lastmod: post.date
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((item) => {
    return `  <url>
    <loc>${item.loc}</loc>${
      item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : ""
    }
  </url>`;
  })
  .join("\n")}
</urlset>
`;

  fs.writeFileSync(path.join(OUTPUT, "sitemap.xml"), xml);
}

function main() {
  console.log("Preparing site...");

  fs.rmSync(OUTPUT, {
    recursive: true,
    force: true
  });

  copyDirectory(ROOT, OUTPUT);

  console.log("Reading blog posts...");

  const posts = readPosts();

  if (process.exitCode === 1) {
    console.error("\nBuild stopped because article metadata is incomplete.");
    process.exit(1);
  }

  writePostsJson(posts);
  writeSitemap(posts);

  console.log(`Built ${posts.length} blog posts.`);
  console.log("_site/blog/posts.json created.");
  console.log("_site/sitemap.xml created.");
}

main();