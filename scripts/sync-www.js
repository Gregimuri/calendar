const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(root, "www");

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

rimraf(www);
fs.mkdirSync(www, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(www, "index.html"));
copyDir(path.join(root, "css"), path.join(www, "css"));
copyDir(path.join(root, "js"), path.join(www, "js"));
copyDir(path.join(root, "assets"), path.join(www, "assets"));

console.log("www synced");
