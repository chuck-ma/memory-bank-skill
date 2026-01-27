#!/usr/bin/env bun
// @bun

// src/cli.ts
import { promises as fs } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
var VERSION = "5.6.0";
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
async function installPluginToConfig(undoStack) {
  const configPath = join(homedir(), ".config", "opencode", "opencode.json");
  const pluginPackageWithVersion = `memory-bank-skill@${VERSION}`;
  const pluginPackagePrefix = "memory-bank-skill";
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
        plugin: [pluginPackageWithVersion]
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
  const oldPluginUrl = `file://${join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts")}`;
  const oldPluginIndex = config.plugin.indexOf(oldPluginUrl);
  if (oldPluginIndex !== -1) {
    config.plugin.splice(oldPluginIndex, 1);
    changes.push("Removed old file:// plugin reference");
    modified = true;
  }
  const matchingIndices = [];
  config.plugin.forEach((p, i) => {
    if (p === pluginPackagePrefix || p.startsWith(`${pluginPackagePrefix}@`)) {
      matchingIndices.push(i);
    }
  });
  if (matchingIndices.length > 1) {
    for (let i = matchingIndices.length - 1;i > 0; i--) {
      const removed = config.plugin.splice(matchingIndices[i], 1)[0];
      changes.push(`Removed duplicate: ${removed}`);
    }
    modified = true;
  }
  const existingIndex = config.plugin.findIndex((p) => p === pluginPackagePrefix || p.startsWith(`${pluginPackagePrefix}@`));
  if (existingIndex !== -1) {
    const existing = config.plugin[existingIndex];
    if (existing !== pluginPackageWithVersion) {
      config.plugin[existingIndex] = pluginPackageWithVersion;
      changes.push(`Updated plugin: ${existing} \u2192 ${pluginPackageWithVersion}`);
      modified = true;
    }
  } else {
    config.plugin.push(pluginPackageWithVersion);
    changes.push(`Added plugin: ${pluginPackageWithVersion}`);
    modified = true;
  }
  if (modified) {
    const newContent = JSON.stringify(config, null, 2) + `
`;
    await atomicWriteFile(configPath, newContent, undoStack);
  }
  return {
    step: "Configuring plugin in opencode.json",
    status: modified ? existed ? "updated" : "created" : "already-configured",
    details: changes.join(", ") || "Already configured"
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
async function checkAndCleanOpenCodeCache() {
  const cacheDir = join(homedir(), ".cache", "opencode");
  const cachePackageJson = join(cacheDir, "package.json");
  const pkgCacheDir = join(cacheDir, "node_modules", "memory-bank-skill");
  const cacheNodeModulesPkg = join(pkgCacheDir, "package.json");
  if (!await exists(cachePackageJson)) {
    return { cleaned: false };
  }
  try {
    const cacheDepContent = await fs.readFile(cachePackageJson, "utf-8");
    const cacheDep = JSON.parse(cacheDepContent);
    const recordedVersion = cacheDep.dependencies?.["memory-bank-skill"];
    if (!recordedVersion) {
      return { cleaned: false };
    }
    let actualVersion = null;
    if (await exists(cacheNodeModulesPkg)) {
      try {
        const actualPkg = JSON.parse(await fs.readFile(cacheNodeModulesPkg, "utf-8"));
        actualVersion = actualPkg.version;
      } catch {}
    }
    const needsClean = recordedVersion === "latest" || recordedVersion !== VERSION || actualVersion && actualVersion !== VERSION;
    if (needsClean) {
      const realCacheDir = await fs.realpath(cacheDir).catch(() => null);
      const expectedPrefix = join(homedir(), ".cache", "opencode");
      if (!realCacheDir || !realCacheDir.startsWith(expectedPrefix)) {
        return { cleaned: false };
      }
      if (await exists(pkgCacheDir)) {
        await fs.rm(pkgCacheDir, { recursive: true, force: true });
      }
      const bunLockb = join(cacheDir, "bun.lockb");
      if (await exists(bunLockb)) {
        await fs.rm(bunLockb, { force: true });
      }
      const newDeps = { ...cacheDep.dependencies };
      delete newDeps["memory-bank-skill"];
      cacheDep.dependencies = newDeps;
      const tmpPath = `${cachePackageJson}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(cacheDep, null, 2) + `
`);
      await fs.rename(tmpPath, cachePackageJson);
      const reason = recordedVersion === "latest" ? `"latest" \u2192 ${VERSION}` : `${recordedVersion} \u2192 ${VERSION}`;
      return {
        cleaned: true,
        message: `Cleaned stale OpenCode cache (${reason})`
      };
    }
  } catch {
    return { cleaned: false };
  }
  return { cleaned: false };
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
    const cacheResult = await checkAndCleanOpenCodeCache();
    if (cacheResult.cleaned) {
      logSuccess(cacheResult.message || "Cleaned OpenCode cache");
      log("");
    }
    logStep(1, 2, "Installing skill files...");
    const r1 = await installSkillFiles(packageRoot, undoStack, manifestFiles);
    logDetail(r1.details || "");
    results.push(r1);
    logStep(2, 2, "Configuring plugin...");
    const r2 = await installPluginToConfig(undoStack);
    logDetail(r2.details || "");
    results.push(r2);
    await writeManifest(manifestFiles, undoStack);
    await cleanupBackups(undoStack);
    const allSkipped = results.every((r) => r.status === "already-configured" || r.status === "skipped");
    log("");
    if (allSkipped) {
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
  let allOk = true;
  const skillPath = join(homedir(), ".config", "opencode", "skill", "memory-bank", "SKILL.md");
  const skillOk = await exists(skillPath);
  if (skillOk) {
    log(`${colors.green}\u2713${colors.reset} Skill files`);
    logDetail(skillPath);
  } else {
    log(`${colors.red}\u2717${colors.reset} Skill files`);
    logDetail(`Missing: ${skillPath}`);
    allOk = false;
  }
  const configPath = join(homedir(), ".config", "opencode", "opencode.json");
  let pluginConfigured = false;
  let pluginVersion = "";
  if (await exists(configPath)) {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      if (Array.isArray(config.plugin)) {
        const entry = config.plugin.find((p) => p === "memory-bank-skill" || p.startsWith("memory-bank-skill@"));
        if (entry) {
          pluginConfigured = true;
          pluginVersion = entry;
        }
      }
    } catch {}
  }
  if (pluginConfigured) {
    log(`${colors.green}\u2713${colors.reset} Plugin configured in opencode.json`);
    logDetail(pluginVersion);
    if (!pluginVersion.includes("@")) {
      log(`${colors.yellow}\u26A0${colors.reset} Consider using pinned version: memory-bank-skill@${VERSION}`);
    }
  } else {
    log(`${colors.red}\u2717${colors.reset} Plugin not configured`);
    logDetail(`Add 'memory-bank-skill@${VERSION}' to plugin array in opencode.json`);
    allOk = false;
  }
  const cacheDir = join(homedir(), ".cache", "opencode");
  const cachePackageJson = join(cacheDir, "package.json");
  if (await exists(cachePackageJson)) {
    try {
      const content = await fs.readFile(cachePackageJson, "utf-8");
      const cacheDep = JSON.parse(content);
      const recordedVersion = cacheDep.dependencies?.["memory-bank-skill"];
      if (recordedVersion) {
        const cacheNodeModules = join(cacheDir, "node_modules", "memory-bank-skill", "package.json");
        if (await exists(cacheNodeModules)) {
          const actualPkg = JSON.parse(await fs.readFile(cacheNodeModules, "utf-8"));
          if (recordedVersion !== actualPkg.version && recordedVersion !== "latest") {
            log(`${colors.yellow}\u26A0${colors.reset} OpenCode cache version mismatch`);
            logDetail(`Recorded: ${recordedVersion}, Actual: ${actualPkg.version}`);
            logDetail(`Run 'bunx memory-bank-skill install' to fix`);
          }
        }
      }
    } catch {}
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
