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
var VERSION = "5.0.0";
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
  const destDir = join(homedir(), ".config", "opencode", "skill", "memory-bank");
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
  const manifestPath = join(homedir(), ".config", "opencode", "skill", "memory-bank", ".manifest.json");
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
    logStep(1, 5, "Installing skill files...");
    const r1 = await installSkillFiles(packageRoot, undoStack, manifestFiles);
    logDetail(r1.details || "");
    results.push(r1);
    logStep(2, 5, "Installing plugin...");
    const r2 = await installPluginFile(packageRoot, undoStack, manifestFiles);
    logDetail(r2.details || "");
    results.push(r2);
    logStep(3, 5, "Configuring opencode.json...");
    const r3 = await configureOpencodeJson(undoStack);
    logDetail(r3.details || "");
    results.push(r3);
    logStep(4, 5, "Ensuring plugin dependencies...");
    const r4 = await ensurePluginDependencies(undoStack);
    logDetail(r4.details || "");
    results.push(r4);
    logStep(5, 5, "Installing dependencies...");
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
      path: join(homedir(), ".config", "opencode", "skill", "memory-bank", "SKILL.md")
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
  const manifestPath = join(homedir(), ".config", "opencode", "skill", "memory-bank", ".manifest.json");
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
