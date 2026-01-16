#!/usr/bin/env bun
/**
 * Memory Bank Skill - Installation CLI
 *
 * Usage: bunx memory-bank-skill install
 *
 * Features:
 * - Idempotent: Safe to run multiple times
 * - Atomic: All-or-nothing with rollback on failure
 * - Simple: No complex TUI, minimal dependencies
 */

import { promises as fs, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

// ============================================================================
// Constants
// ============================================================================

const VERSION = "5.2.0"
// ============================================================================
// Types
// ============================================================================

interface UndoAction {
  type: "restore" | "remove" | "remove-dir"
  path: string
  backupPath?: string
}

interface InstallResult {
  step: string
  status: "created" | "updated" | "skipped" | "already-configured"
  details?: string
}

interface Manifest {
  version: string
  installedAt: string
  files: { path: string; sha256: string }[]
}

// ============================================================================
// Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
}

function log(msg: string) {
  console.log(msg)
}

function logStep(num: number, total: number, msg: string) {
  log(`${colors.cyan}[${num}/${total}]${colors.reset} ${msg}`)
}

function logDetail(msg: string) {
  log(`      ${colors.dim}→${colors.reset} ${msg}`)
}

function logSuccess(msg: string) {
  log(`${colors.green}✓${colors.reset} ${msg}`)
}

function logError(msg: string) {
  log(`${colors.red}✗${colors.reset} ${msg}`)
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex")
}

function getPackageRoot(): string {
  // When running from npm package, __dirname points to dist/
  // We need to go up one level to get package root
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  // Check if we're in dist/ or src/
  if (__dirname.endsWith("/dist") || __dirname.endsWith("\\dist")) {
    return dirname(__dirname)
  }
  // Development: we're in src/
  if (__dirname.endsWith("/src") || __dirname.endsWith("\\src")) {
    return dirname(__dirname)
  }
  return __dirname
}

// ============================================================================
// Atomic Operations
// ============================================================================

async function atomicWriteFile(
  targetPath: string,
  content: string | Buffer,
  undoStack: UndoAction[]
): Promise<void> {
  const tmpPath = `${targetPath}.tmp`

  // Ensure parent directory exists
  await ensureDir(dirname(targetPath))

  // Backup original if exists
  if (await exists(targetPath)) {
    const backupPath = `${targetPath}.backup`
    const original = await fs.readFile(targetPath)
    await fs.writeFile(backupPath, original)
    undoStack.push({ type: "restore", path: targetPath, backupPath })
  } else {
    undoStack.push({ type: "remove", path: targetPath })
  }

  // Write to temp then atomic rename
  await fs.writeFile(tmpPath, content)
  await fs.rename(tmpPath, targetPath)
}

async function atomicCopyDir(
  srcDir: string,
  destDir: string,
  undoStack: UndoAction[],
  manifestFiles: { path: string; sha256: string }[]
): Promise<void> {
  const dirExisted = await exists(destDir)

  if (!dirExisted) {
    undoStack.push({ type: "remove-dir", path: destDir })
  }

  await ensureDir(destDir)

  const entries = await fs.readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)

    if (entry.isDirectory()) {
      await atomicCopyDir(srcPath, destPath, undoStack, manifestFiles)
    } else if (entry.isFile()) {
      const content = await fs.readFile(srcPath)
      await atomicWriteFile(destPath, content, undoStack)
      manifestFiles.push({ path: destPath, sha256: sha256(content) })
    }
  }
}

async function rollback(undoStack: UndoAction[]): Promise<void> {
  log(`\n${colors.yellow}Rolling back...${colors.reset}`)

  // Execute in reverse order
  for (let i = undoStack.length - 1; i >= 0; i--) {
    const action = undoStack[i]
    try {
      switch (action.type) {
        case "restore":
          if (action.backupPath && (await exists(action.backupPath))) {
            await fs.rename(action.backupPath, action.path)
            logDetail(`Restored ${action.path}`)
          }
          break
        case "remove":
          if (await exists(action.path)) {
            await fs.unlink(action.path)
            logDetail(`Removed ${action.path}`)
          }
          break
        case "remove-dir":
          if (await exists(action.path)) {
            await fs.rm(action.path, { recursive: true })
            logDetail(`Removed directory ${action.path}`)
          }
          break
      }
    } catch (err) {
      // Best effort rollback, log but continue
      console.error(`  Rollback failed for ${action.path}: ${err}`)
    }
  }
}

async function cleanupBackups(undoStack: UndoAction[]): Promise<void> {
  for (const action of undoStack) {
    if (action.type === "restore" && action.backupPath) {
      try {
        if (await exists(action.backupPath)) {
          await fs.unlink(action.backupPath)
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// Installation Steps
// ============================================================================

async function installSkillFiles(
  packageRoot: string,
  undoStack: UndoAction[],
  manifestFiles: { path: string; sha256: string }[]
): Promise<InstallResult> {
  const srcDir = join(packageRoot, "skill", "memory-bank")
  const destDir = join(homedir(), ".config", "opencode", "skill", "memory-bank")

  if (!(await exists(srcDir))) {
    throw new Error(`Skill source not found: ${srcDir}`)
  }

  const existed = await exists(destDir)
  await atomicCopyDir(srcDir, destDir, undoStack, manifestFiles)

  return {
    step: "Installing skill files",
    status: existed ? "updated" : "created",
    details: destDir,
  }
}

async function installPluginFile(
  packageRoot: string,
  undoStack: UndoAction[],
  manifestFiles: { path: string; sha256: string }[]
): Promise<InstallResult> {
  const srcPath = join(packageRoot, "plugin", "memory-bank.ts")
  const destPath = join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts")

  if (!(await exists(srcPath))) {
    throw new Error(`Plugin source not found: ${srcPath}`)
  }

  const existed = await exists(destPath)
  const content = await fs.readFile(srcPath)
  await atomicWriteFile(destPath, content, undoStack)
  manifestFiles.push({ path: destPath, sha256: sha256(content) })

  return {
    step: "Installing plugin",
    status: existed ? "updated" : "created",
    details: destPath,
  }
}

async function configureOpencodeJson(
  undoStack: UndoAction[]
): Promise<InstallResult> {
  const configPath = join(homedir(), ".config", "opencode", "opencode.json")
  const pluginPath = join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts")
  const pluginUrl = `file://${pluginPath}`

  let config: any = {}
  let existed = false
  let modified = false
  const changes: string[] = []

  if (await exists(configPath)) {
    existed = true
    try {
      const content = await fs.readFile(configPath, "utf-8")
      config = JSON.parse(content)
    } catch (err) {
      throw new Error(
        `Failed to parse ${configPath}: ${err}\n\n` +
          `Please fix the JSON manually, or add this to your config:\n\n` +
          JSON.stringify(
            {
              permission: { skill: "allow" },
              plugin: [pluginUrl],
            },
            null,
            2
          )
      )
    }
  }

  // Ensure permission.skill = "allow"
  if (!config.permission) {
    config.permission = {}
  }
  if (config.permission.skill !== "allow") {
    config.permission.skill = "allow"
    changes.push('Added permission.skill = "allow"')
    modified = true
  }

  // Ensure plugin array contains our plugin
  if (!Array.isArray(config.plugin)) {
    config.plugin = []
  }
  if (!config.plugin.includes(pluginUrl)) {
    config.plugin.push(pluginUrl)
    changes.push("Added plugin entry")
    modified = true
  }

  if (modified) {
    const newContent = JSON.stringify(config, null, 2) + "\n"
    await atomicWriteFile(configPath, newContent, undoStack)
  }

  return {
    step: "Configuring opencode.json",
    status: modified ? (existed ? "updated" : "created") : "already-configured",
    details: changes.join(", ") || "Already configured",
  }
}

async function ensurePluginDependencies(
  undoStack: UndoAction[]
): Promise<InstallResult> {
  const packageJsonPath = join(homedir(), ".config", "opencode", "package.json")

  let pkg: any = { dependencies: {} }
  let existed = false
  let modified = false

  if (await exists(packageJsonPath)) {
    existed = true
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8")
      pkg = JSON.parse(content)
    } catch (err) {
      throw new Error(
        `Failed to parse ${packageJsonPath}: ${err}\n\n` +
          `Please fix the JSON manually, or add this to your config:\n\n` +
          JSON.stringify(
            {
              dependencies: {
                "@opencode-ai/plugin": "^1.1.14",
              },
            },
            null,
            2
          )
      )
    }
  }

  if (!pkg.dependencies) {
    pkg.dependencies = {}
  }

  if (!pkg.dependencies["@opencode-ai/plugin"]) {
    pkg.dependencies["@opencode-ai/plugin"] = "^1.1.14"
    modified = true
  }

  if (modified) {
    const newContent = JSON.stringify(pkg, null, 2) + "\n"
    await atomicWriteFile(packageJsonPath, newContent, undoStack)
  }

  return {
    step: "Ensuring plugin dependencies",
    status: modified ? (existed ? "updated" : "created") : "already-configured",
    details: modified ? "Added @opencode-ai/plugin" : "Already present",
  }
}

async function writeManifest(
  manifestFiles: { path: string; sha256: string }[],
  undoStack: UndoAction[]
): Promise<void> {
  const manifestPath = join(
    homedir(),
    ".config",
    "opencode",
    "skill",
    "memory-bank",
    ".manifest.json"
  )

  const manifest: Manifest = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    files: manifestFiles,
  }

  await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", undoStack)
}

// ============================================================================
// Main Commands
// ============================================================================

async function runBunInstall(): Promise<boolean> {
  const opencodeDir = join(homedir(), ".config", "opencode")
  const nodeModulesPath = join(opencodeDir, "node_modules", "@opencode-ai", "plugin")
  
  // Check if dependencies already installed
  if (await exists(nodeModulesPath)) {
    return true // Already installed
  }
  
  try {
    const { execSync } = await import("node:child_process")
    execSync("bun install", {
      cwd: opencodeDir,
      stdio: "pipe",
      timeout: 60000,
    })
    return true
  } catch (err) {
    return false
  }
}

async function install(): Promise<void> {
  log(`\n${colors.bold}Memory Bank Skill Installer v${VERSION}${colors.reset}\n`)

  const packageRoot = getPackageRoot()
  const undoStack: UndoAction[] = []
  const manifestFiles: { path: string; sha256: string }[] = []
  const results: InstallResult[] = []

  try {
    // Step 1: Install skill files
    logStep(1, 5, "Installing skill files...")
    const r1 = await installSkillFiles(packageRoot, undoStack, manifestFiles)
    logDetail(r1.details || "")
    results.push(r1)

    // Step 2: Install plugin
    logStep(2, 5, "Installing plugin...")
    const r2 = await installPluginFile(packageRoot, undoStack, manifestFiles)
    logDetail(r2.details || "")
    results.push(r2)

    // Step 3: Configure opencode.json
    logStep(3, 5, "Configuring opencode.json...")
    const r3 = await configureOpencodeJson(undoStack)
    logDetail(r3.details || "")
    results.push(r3)

    // Step 4: Ensure plugin dependencies
    logStep(4, 5, "Ensuring plugin dependencies...")
    const r4 = await ensurePluginDependencies(undoStack)
    logDetail(r4.details || "")
    results.push(r4)

    // Step 5: Run bun install
    logStep(5, 5, "Installing dependencies...")
    const bunSuccess = await runBunInstall()
    if (bunSuccess) {
      logDetail("Dependencies ready")
    } else {
      logDetail(`${colors.yellow}Run manually: cd ~/.config/opencode && bun install${colors.reset}`)
    }

    // Write manifest
    await writeManifest(manifestFiles, undoStack)

    // Clean up backup files on success
    await cleanupBackups(undoStack)

    // Summary
    const allSkipped = results.every((r) => r.status === "already-configured" || r.status === "skipped")

    log("")
    if (allSkipped && bunSuccess) {
      logSuccess(`Already installed (v${VERSION})`)
    } else {
      logSuccess("Installation complete!")
    }
    log("")
    log(`${colors.bold}Next step:${colors.reset} Restart OpenCode`)
    log("")
  } catch (err) {
    await rollback(undoStack)
    log("")
    logError(`Installation failed: ${err}`)
    log("")
    process.exit(1)
  }
}

async function doctor(): Promise<void> {
  log(`\n${colors.bold}Memory Bank Skill Doctor v${VERSION}${colors.reset}\n`)

  const checks = [
    {
      name: "Skill files",
      path: join(homedir(), ".config", "opencode", "skill", "memory-bank", "SKILL.md"),
    },
    {
      name: "Plugin file",
      path: join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts"),
    },
    {
      name: "OpenCode config",
      path: join(homedir(), ".config", "opencode", "opencode.json"),
    },
    {
      name: "Plugin dependencies",
      path: join(homedir(), ".config", "opencode", "package.json"),
    },
  ]

  let allOk = true

  for (const check of checks) {
    const ok = await exists(check.path)
    if (ok) {
      log(`${colors.green}✓${colors.reset} ${check.name}`)
      logDetail(check.path)
    } else {
      log(`${colors.red}✗${colors.reset} ${check.name}`)
      logDetail(`Missing: ${check.path}`)
      allOk = false
    }
  }

  // Check manifest
  const manifestPath = join(homedir(), ".config", "opencode", "skill", "memory-bank", ".manifest.json")
  if (await exists(manifestPath)) {
    try {
      const manifest: Manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
      log("")
      log(`${colors.dim}Installed version: ${manifest.version}${colors.reset}`)
      log(`${colors.dim}Installed at: ${manifest.installedAt}${colors.reset}`)
    } catch {
      // Ignore manifest parse errors
    }
  }

  log("")
  if (allOk) {
    logSuccess("All checks passed!")
  } else {
    logError("Some checks failed. Run 'bunx memory-bank-skill install' to fix.")
  }
  log("")

  process.exit(allOk ? 0 : 1)
}

function showHelp(): void {
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
`)
}

// ============================================================================
// Entry Point
// ============================================================================

const command = process.argv[2]

switch (command) {
  case "install":
    install()
    break
  case "doctor":
    doctor()
    break
  case "--help":
  case "-h":
  case undefined:
    showHelp()
    break
  default:
    log(`Unknown command: ${command}`)
    showHelp()
    process.exit(1)
}
