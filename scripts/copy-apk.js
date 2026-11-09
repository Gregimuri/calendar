const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const releaseDir = path.join(root, "release");
const releaseDest = path.join(releaseDir, "calendar-debug.apk");
const pagesDir = path.join(root, "apk");
const pagesDest = path.join(pagesDir, "calendar.apk");

if (!fs.existsSync(src)) {
  console.error("APK not found:", src);
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });
fs.copyFileSync(src, releaseDest);
fs.copyFileSync(src, pagesDest);
console.log("APK ready:", releaseDest);
console.log("Pages APK:", pagesDest);
