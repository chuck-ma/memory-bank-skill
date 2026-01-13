#!/usr/bin/env bun
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = import.meta.require;

// src/cli.ts
import { promises as fs } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
var VERSION = "4.0.0";
var SENTINEL_BEGIN = "<!-- memory-bank-skill:begin -->";
var SENTINEL_END = "<!-- memory-bank-skill:end -->";
var CLAUDE_MD_BLOCK = `${SENTINEL_BEGIN}
## Memory Bank\uFF08\u9879\u76EE\u8BB0\u5FC6\u7CFB\u7EDF\uFF09

\u6BCF\u6B21\u4F1A\u8BDD\u5F00\u59CB\u65F6\uFF0C\u68C0\u67E5 \`memory-bank/\` \u76EE\u5F55\uFF1A

1. **\u5B58\u5728** \u2192 \u8BFB\u53D6 \`memory-bank/brief.md\` + \`memory-bank/active.md\` \u83B7\u53D6\u9879\u76EE\u4E0A\u4E0B\u6587
2. **\u4E0D\u5B58\u5728** \u2192 \u9996\u6B21\u5DE5\u4F5C\u65F6\u626B\u63CF\u9879\u76EE\u7ED3\u6784\uFF08README.md\u3001pyproject.toml \u7B49\uFF09\uFF0C\u521B\u5EFA \`memory-bank/\` \u5E76\u751F\u6210 \`brief.md\` + \`tech.md\`

\u5DE5\u4F5C\u8FC7\u7A0B\u4E2D\uFF0C\u68C0\u6D4B\u5230\u4EE5\u4E0B\u4E8B\u4EF6\u65F6\u6309 \`/memory-bank\` skill \u89C4\u5219\u5199\u5165\uFF1A
- **\u65B0\u9700\u6C42**\uFF1A\u521B\u5EFA \`requirements/REQ-xxx.md\`
- **\u6280\u672F\u51B3\u7B56**\uFF1A\u8FFD\u52A0\u5230 \`patterns.md\`
- **\u7ECF\u9A8C\u6559\u8BAD**\uFF08bug/\u6027\u80FD/\u96C6\u6210\u8E29\u5751\uFF09\uFF1A\u521B\u5EFA \`learnings/xxx.md\`

\u5199\u5165\u524D\u8F93\u51FA\u8BA1\u5212\uFF0C\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u3002\u8BE6\u7EC6\u89C4\u5219\u89C1 \`~/.claude/skills/memory-bank/SKILL.md\`\u3002
${SENTINEL_END}`;
var colors = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  red: "\x1B[31m",
  cyan: "\x1B[36m"
};
function log(msg) {
  console.log(msg);
}
function logStep(num, total, msg) {
  log(`${colors.cyan}[${num}/${total}]${colors.reset} ${msg}`);
}
function logDetail(msg) {
  log(`      ${colors.dim}\u2192${colors.reset} ${msg}`);
}
function logSuccess(msg) {
  log(`${colors.green}\u2713${colors.reset} ${msg}`);
}
function logError(msg) {
  log(`${colors.red}\u2717${colors.reset} ${msg}`);
}
async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
function getPackageRoot() {
  const __filename2 = fileURLToPath(import.meta.url);
  const __dirname2 = dirname(__filename2);
  if (__dirname2.endsWith("/dist") || __dirname2.endsWith("\\dist")) {
    return dirname(__dirname2);
  }
  if (__dirname2.endsWith("/src") || __dirname2.endsWith("\\src")) {
    return dirname(__dirname2);
  }
  return __dirname2;
}
async function atomicWriteFile(targetPath, content, undoStack) {
  const tmpPath = `${targetPath}.tmp`;
  await ensureDir(dirname(targetPath));
  if (await exists(targetPath)) {
    const backupPath = `${targetPath}.backup`;
    const original = await fs.readFile(targetPath);
    await fs.writeFile(backupPath, original);
    undoStack.push({ type: "restore", path: targetPath, backupPath });
  } else {
    undoStack.push({ type: "remove", path: targetPath });
  }
  await fs.writeFile(tmpPath, content);
  await fs.rename(tmpPath, targetPath);
}
async function atomicCopyDir(srcDir, destDir, undoStack, manifestFiles) {
  const dirExisted = await exists(destDir);
  if (!dirExisted) {
    undoStack.push({ type: "remove-dir", path: destDir });
  }
  await ensureDir(destDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await atomicCopyDir(srcPath, destPath, undoStack, manifestFiles);
    } else if (entry.isFile()) {
      const content = await fs.readFile(srcPath);
      await atomicWriteFile(destPath, content, undoStack);
      manifestFiles.push({ path: destPath, sha256: sha256(content) });
    }
  }
}
async function rollback(undoStack) {
  log(`
${colors.yellow}Rolling back...${colors.reset}`);
  for (let i = undoStack.length - 1;i >= 0; i--) {
    const action = undoStack[i];
    try {
      switch (action.type) {
        case "restore":
          if (action.backupPath && await exists(action.backupPath)) {
            await fs.rename(action.backupPath, action.path);
            logDetail(`Restored ${action.path}`);
          }
          break;
        case "remove":
          if (await exists(action.path)) {
            await fs.unlink(action.path);
            logDetail(`Removed ${action.path}`);
          }
          break;
        case "remove-dir":
          if (await exists(action.path)) {
            await fs.rm(action.path, { recursive: true });
            logDetail(`Removed directory ${action.path}`);
          }
          break;
      }
    } catch (err) {
      console.error(`  Rollback failed for ${action.path}: ${err}`);
    }
  }
}
async function cleanupBackups(undoStack) {
  for (const action of undoStack) {
    if (action.type === "restore" && action.backupPath) {
      try {
        if (await exists(action.backupPath)) {
          await fs.unlink(action.backupPath);
        }
      } catch {}
    }
  }
}
async function installSkillFiles(packageRoot, undoStack, manifestFiles) {
  const srcDir = join(packageRoot, "skill", "memory-bank");
  const destDir = join(homedir(), ".claude", "skills", "memory-bank");
  if (!await exists(srcDir)) {
    throw new Error(`Skill source not found: ${srcDir}`);
  }
  const existed = await exists(destDir);
  await atomicCopyDir(srcDir, destDir, undoStack, manifestFiles);
  return {
    step: "Installing skill files",
    status: existed ? "updated" : "created",
    details: destDir
  };
}
async function installPluginFile(packageRoot, undoStack, manifestFiles) {
  const srcPath = join(packageRoot, "plugin", "memory-bank.ts");
  const destPath = join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts");
  if (!await exists(srcPath)) {
    throw new Error(`Plugin source not found: ${srcPath}`);
  }
  const existed = await exists(destPath);
  const content = await fs.readFile(srcPath);
  await atomicWriteFile(destPath, content, undoStack);
  manifestFiles.push({ path: destPath, sha256: sha256(content) });
  return {
    step: "Installing plugin",
    status: existed ? "updated" : "created",
    details: destPath
  };
}
async function configureOpencodeJson(undoStack) {
  const configPath = join(homedir(), ".config", "opencode", "opencode.json");
  const pluginPath = join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts");
  const pluginUrl = `file://${pluginPath}`;
  let config = {};
  let existed = false;
  let modified = false;
  const changes = [];
  if (await exists(configPath)) {
    existed = true;
    try {
      const content = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse ${configPath}: ${err}

` + `Please fix the JSON manually, or add this to your config:

` + JSON.stringify({
        permission: { skill: "allow" },
        plugin: [pluginUrl]
      }, null, 2));
    }
  }
  if (!config.permission) {
    config.permission = {};
  }
  if (config.permission.skill !== "allow") {
    config.permission.skill = "allow";
    changes.push('Added permission.skill = "allow"');
    modified = true;
  }
  if (!Array.isArray(config.plugin)) {
    config.plugin = [];
  }
  if (!config.plugin.includes(pluginUrl)) {
    config.plugin.push(pluginUrl);
    changes.push("Added plugin entry");
    modified = true;
  }
  if (modified) {
    const newContent = JSON.stringify(config, null, 2) + `
`;
    await atomicWriteFile(configPath, newContent, undoStack);
  }
  return {
    step: "Configuring opencode.json",
    status: modified ? existed ? "updated" : "created" : "already-configured",
    details: changes.join(", ") || "Already configured"
  };
}
async function configureClaudeMd(undoStack) {
  const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
  let content = "";
  let existed = false;
  if (await exists(claudeMdPath)) {
    existed = true;
    content = await fs.readFile(claudeMdPath, "utf-8");
  }
  const beginIdx = content.indexOf(SENTINEL_BEGIN);
  const endIdx = content.indexOf(SENTINEL_END);
  let newContent;
  let modified = false;
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = content.slice(0, beginIdx);
    const after = content.slice(endIdx + SENTINEL_END.length);
    newContent = before + CLAUDE_MD_BLOCK + after;
    modified = newContent !== content;
  } else {
    newContent = content.trimEnd() + `

` + CLAUDE_MD_BLOCK + `
`;
    modified = true;
  }
  if (modified) {
    await atomicWriteFile(claudeMdPath, newContent, undoStack);
  }
  return {
    step: "Configuring CLAUDE.md",
    status: modified ? existed ? "updated" : "created" : "already-configured",
    details: modified ? "Added startup instructions" : "Already configured"
  };
}
async function ensurePluginDependencies(undoStack) {
  const packageJsonPath = join(homedir(), ".config", "opencode", "package.json");
  let pkg = { dependencies: {} };
  let existed = false;
  let modified = false;
  if (await exists(packageJsonPath)) {
    existed = true;
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      pkg = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse ${packageJsonPath}: ${err}

` + `Please fix the JSON manually, or add this to your config:

` + JSON.stringify({
        dependencies: {
          "@opencode-ai/plugin": "^1.1.14"
        }
      }, null, 2));
    }
  }
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  if (!pkg.dependencies["@opencode-ai/plugin"]) {
    pkg.dependencies["@opencode-ai/plugin"] = "^1.1.14";
    modified = true;
  }
  if (modified) {
    const newContent = JSON.stringify(pkg, null, 2) + `
`;
    await atomicWriteFile(packageJsonPath, newContent, undoStack);
  }
  return {
    step: "Ensuring plugin dependencies",
    status: modified ? existed ? "updated" : "created" : "already-configured",
    details: modified ? "Added @opencode-ai/plugin" : "Already present"
  };
}
async function writeManifest(manifestFiles, undoStack) {
  const manifestPath = join(homedir(), ".claude", "skills", "memory-bank", ".manifest.json");
  const manifest = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    files: manifestFiles
  };
  await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2) + `
`, undoStack);
}
async function runBunInstall() {
  const opencodeDir = join(homedir(), ".config", "opencode");
  const nodeModulesPath = join(opencodeDir, "node_modules", "@opencode-ai", "plugin");
  if (await exists(nodeModulesPath)) {
    return true;
  }
  try {
    const { execSync } = await import("child_process");
    execSync("bun install", {
      cwd: opencodeDir,
      stdio: "pipe",
      timeout: 60000
    });
    return true;
  } catch (err) {
    return false;
  }
}
async function install() {
  log(`
${colors.bold}Memory Bank Skill Installer v${VERSION}${colors.reset}
`);
  const packageRoot = getPackageRoot();
  const undoStack = [];
  const manifestFiles = [];
  const results = [];
  try {
    logStep(1, 6, "Installing skill files...");
    const r1 = await installSkillFiles(packageRoot, undoStack, manifestFiles);
    logDetail(r1.details || "");
    results.push(r1);
    logStep(2, 6, "Installing plugin...");
    const r2 = await installPluginFile(packageRoot, undoStack, manifestFiles);
    logDetail(r2.details || "");
    results.push(r2);
    logStep(3, 6, "Configuring opencode.json...");
    const r3 = await configureOpencodeJson(undoStack);
    logDetail(r3.details || "");
    results.push(r3);
    logStep(4, 6, "Configuring CLAUDE.md...");
    const r4 = await configureClaudeMd(undoStack);
    logDetail(r4.details || "");
    results.push(r4);
    logStep(5, 6, "Ensuring plugin dependencies...");
    const r5 = await ensurePluginDependencies(undoStack);
    logDetail(r5.details || "");
    results.push(r5);
    logStep(6, 6, "Installing dependencies...");
    const bunSuccess = await runBunInstall();
    if (bunSuccess) {
      logDetail("Dependencies ready");
    } else {
      logDetail(`${colors.yellow}Run manually: cd ~/.config/opencode && bun install${colors.reset}`);
    }
    await writeManifest(manifestFiles, undoStack);
    await cleanupBackups(undoStack);
    const allSkipped = results.every((r) => r.status === "already-configured" || r.status === "skipped");
    log("");
    if (allSkipped && bunSuccess) {
      logSuccess(`Already installed (v${VERSION})`);
    } else {
      logSuccess("Installation complete!");
    }
    log("");
    log(`${colors.bold}Next step:${colors.reset} Restart OpenCode`);
    log("");
  } catch (err) {
    await rollback(undoStack);
    log("");
    logError(`Installation failed: ${err}`);
    log("");
    process.exit(1);
  }
}
async function doctor() {
  log(`
${colors.bold}Memory Bank Skill Doctor v${VERSION}${colors.reset}
`);
  const checks = [
    {
      name: "Skill files",
      path: join(homedir(), ".claude", "skills", "memory-bank", "SKILL.md")
    },
    {
      name: "Plugin file",
      path: join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts")
    },
    {
      name: "OpenCode config",
      path: join(homedir(), ".config", "opencode", "opencode.json")
    },
    {
      name: "CLAUDE.md",
      path: join(homedir(), ".claude", "CLAUDE.md")
    },
    {
      name: "Plugin dependencies",
      path: join(homedir(), ".config", "opencode", "package.json")
    }
  ];
  let allOk = true;
  for (const check of checks) {
    const ok = await exists(check.path);
    if (ok) {
      log(`${colors.green}\u2713${colors.reset} ${check.name}`);
      logDetail(check.path);
    } else {
      log(`${colors.red}\u2717${colors.reset} ${check.name}`);
      logDetail(`Missing: ${check.path}`);
      allOk = false;
    }
  }
  const manifestPath = join(homedir(), ".claude", "skills", "memory-bank", ".manifest.json");
  if (await exists(manifestPath)) {
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
      log("");
      log(`${colors.dim}Installed version: ${manifest.version}${colors.reset}`);
      log(`${colors.dim}Installed at: ${manifest.installedAt}${colors.reset}`);
    } catch {}
  }
  log("");
  if (allOk) {
    logSuccess("All checks passed!");
  } else {
    logError("Some checks failed. Run 'bunx memory-bank-skill install' to fix.");
  }
  log("");
  process.exit(allOk ? 0 : 1);
}
function showHelp() {
  log(`
${colors.bold}Memory Bank Skill v${VERSION}${colors.reset}

Usage:
  bunx memory-bank-skill <command>

Commands:
  install    Install Memory Bank skill and plugin
  doctor     Check installation status

Examples:
  bunx memory-bank-skill install
  bunx memory-bank-skill doctor
`);
}
var command = process.argv[2];
switch (command) {
  case "install":
    install();
    break;
  case "doctor":
    doctor();
    break;
  case "--help":
  case "-h":
  case undefined:
    showHelp();
    break;
  default:
    log(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
