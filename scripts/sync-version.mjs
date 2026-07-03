// 把版本号同步到 package.json / tauri.conf.json / Cargo.toml。
// CI 在打 tag 发布时调用：node scripts/sync-version.mjs "$GITHUB_REF_NAME"
// tag = 内部 version = 更新器版本 = 展示版本，一处来源，避免检查更新失效。
import { readFileSync, writeFileSync } from "node:fs";

const raw = process.argv[2] || process.env.GITHUB_REF_NAME || "";
const version = raw.replace(/^v/, "").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    `✗ 版本号必须是 3 段 semver（如 v1.2.3），收到的是「${raw}」。` +
      `\n  Tauri 更新器按 semver 比较版本，4 段 tag（如 v0.2.3.0）无法识别。`,
  );
  process.exit(1);
}

const setJsonVersion = (file) => {
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = version;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
};

setJsonVersion("package.json");
setJsonVersion("src-tauri/tauri.conf.json");

const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"/m,
  `version = "${version}"`,
);
writeFileSync(cargoPath, cargo);

console.log(`✓ 已把版本同步为 ${version}`);
