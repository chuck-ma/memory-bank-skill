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
import pkg from "../package.json"

// ============================================================================
// Constants
// ============================================================================

const VERSION = pkg.version
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
  const skills = ["memory-bank"]
  const baseDestDir = join(homedir(), ".config", "opencode", "skills")
  let anyExisted = false

  for (const skill of skills) {
    const srcDir = join(packageRoot, "skills", skill)
    const destDir = join(baseDestDir, skill)

    if (!(await exists(srcDir))) {
      throw new Error(`Skill source not found: ${srcDir}`)
    }

    if (await exists(destDir)) {
      anyExisted = true
    }
    await atomicCopyDir(srcDir, destDir, undoStack, manifestFiles)
  }

  return {
    step: "Installing skill files",
    status: anyExisted ? "updated" : "created",
    details: baseDestDir,
  }
}

async function installPluginToConfig(
  undoStack: UndoAction[],
  customModel?: string
): Promise<InstallResult> {
  const configPath = join(homedir(), ".config", "opencode", "opencode.json")
  const pluginPackageWithVersion = `memory-bank-skill@${VERSION}`
  const pluginPackagePrefix = "memory-bank-skill"

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
              plugin: [pluginPackageWithVersion],
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

  if (!Array.isArray(config.plugin)) {
    config.plugin = []
  }
  
  const oldPluginUrl = `file://${join(homedir(), ".config", "opencode", "plugin", "memory-bank.ts")}`
  const oldPluginIndex = config.plugin.indexOf(oldPluginUrl)
  if (oldPluginIndex !== -1) {
    config.plugin.splice(oldPluginIndex, 1)
    changes.push("Removed old file:// plugin reference")
    modified = true
  }
  
  const matchingIndices: number[] = []
  config.plugin.forEach((p: string, i: number) => {
    if (p === pluginPackagePrefix || p.startsWith(`${pluginPackagePrefix}@`)) {
      matchingIndices.push(i)
    }
  })
  
  if (matchingIndices.length > 1) {
    for (let i = matchingIndices.length - 1; i > 0; i--) {
      const removed = config.plugin.splice(matchingIndices[i], 1)[0]
      changes.push(`Removed duplicate: ${removed}`)
    }
    modified = true
  }
  
  const existingIndex = config.plugin.findIndex((p: string) => 
    p === pluginPackagePrefix || p.startsWith(`${pluginPackagePrefix}@`)
  )
  
  if (existingIndex !== -1) {
    const existing = config.plugin[existingIndex]
    if (existing !== pluginPackageWithVersion) {
      config.plugin[existingIndex] = pluginPackageWithVersion
      changes.push(`Updated plugin: ${existing} → ${pluginPackageWithVersion}`)
      modified = true
    }
  } else {
    config.plugin.push(pluginPackageWithVersion)
    changes.push(`Added plugin: ${pluginPackageWithVersion}`)
    modified = true
  }

  if (!config.agent) {
    config.agent = {}
  }
  
  const defaultModel = "cliproxy/claude-opus-4-5-20251101"
  const installedBy = `memory-bank-skill@${VERSION}`
  
  const writerDefaults = {
    description: "Memory Bank 专用写入代理",
    model: customModel || defaultModel,
    tools: { write: true, edit: true, bash: true },
    "x-installed-by": installedBy
  }
  
  const readerDefaults = {
    description: "Memory Bank 并行读取代理，返回结构化上下文包",
    model: customModel || defaultModel,
    tools: { read: true, glob: true, grep: true },
    "x-installed-by": installedBy
  }
  
  const mergeAgent = (existing: any, defaults: any, name: string): boolean => {
    if (!existing) {
      config.agent[name] = defaults
      changes.push(`Added agent: ${name}`)
      return true
    }
    
    let agentModified = false
    for (const key of Object.keys(defaults)) {
      if (key === "model" || key === "tools") continue
      if (!(key in existing)) {
        existing[key] = defaults[key]
        agentModified = true
      }
    }
    
    if (!existing.tools) {
      existing.tools = defaults.tools
      agentModified = true
    } else {
      for (const tool of Object.keys(defaults.tools)) {
        if (!(tool in existing.tools)) {
          existing.tools[tool] = defaults.tools[tool]
          agentModified = true
        }
      }
    }
    
    if (agentModified) {
      existing["x-installed-by"] = installedBy
      changes.push(`Updated agent: ${name} (filled missing fields)`)
    }
    return agentModified
  }
  
  if (mergeAgent(config.agent["memory-bank-writer"], writerDefaults, "memory-bank-writer")) {
    modified = true
  }
  
  if (mergeAgent(config.agent["memory-reader"], readerDefaults, "memory-reader")) {
    modified = true
  }

  if (modified) {
    const newContent = JSON.stringify(config, null, 2) + "\n"
    await atomicWriteFile(configPath, newContent, undoStack)
  }

  return {
    step: "Configuring plugin in opencode.json",
    status: modified ? (existed ? "updated" : "created") : "already-configured",
    details: changes.join(", ") || "Already configured",
  }
}

async function installCommands(
  undoStack: UndoAction[],
  manifestFiles: { path: string; sha256: string }[]
): Promise<InstallResult> {
  const commandsDir = join(homedir(), ".config", "opencode", "commands")
  const commandPath = join(commandsDir, "memory-bank-refresh.md")
  
  const commandContent = `---
description: 初始化、迁移或刷新 Memory Bank
agent: memory-bank-writer
---

执行 Memory Bank 的 refresh 流程：

## 检测当前结构

1. 检查 \`memory-bank/\` 目录是否存在
2. 检查是新结构（MEMORY.md）还是旧结构（_index.md, brief.md, active.md）

## 根据检测结果执行

- **不存在 memory-bank/**：执行初始化流程
- **存在 MEMORY.md**：执行刷新流程
- **存在旧结构**：执行迁移流程

## 流程详情

详见 \`~/.config/opencode/skills/memory-bank/references/writer.md\` 的 Refresh 流程章节。

**重要**：执行前输出操作计划，等待用户确认后再执行。
`

  await ensureDir(commandsDir)
  const existed = await exists(commandPath)
  await atomicWriteFile(commandPath, commandContent, undoStack)
  manifestFiles.push({ path: commandPath, sha256: sha256(commandContent) })

  return {
    step: "Installing slash commands",
    status: existed ? "updated" : "created",
    details: commandPath,
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
    "skills",
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
// Oh-My-OpenCode Integration
// ============================================================================

const MEMORY_BANK_KEY_TRIGGER_MARKER = "Memory Bank Key Triggers"
const MEMORY_BANK_KEY_TRIGGER_BEGIN = "<!-- BEGIN_MEMORY_BANK_KEY_TRIGGERS -->"
const MEMORY_BANK_KEY_TRIGGER_END = "<!-- END_MEMORY_BANK_KEY_TRIGGERS -->"

const MEMORY_BANK_KEY_TRIGGER = `${MEMORY_BANK_KEY_TRIGGER_BEGIN}
### ${MEMORY_BANK_KEY_TRIGGER_MARKER} (SYNC Task Tool)

These triggers use proxy_task (the Task tool) for synchronous subagent execution.

---

AMENDMENT A — Phase 0: Memory Bank Reader (Context Read)

Step R0 Timing:
- BEFORE solving user's request, if project context is needed, run memory-reader FIRST.

Step R1 Trigger (any):
- User asks about repo architecture, decisions, conventions, current focus
- User asks about prior work, existing modules, how something works
- You are about to make non-trivial changes and need repo-specific constraints

Step R2 Skip:
- User says "skip memory-bank" or "不需要上下文"
- Request is about Memory Bank itself (keywords: memory-bank/, memory-reader, memory-bank-writer, /memory-bank, MEMORY.md, details/patterns.md, details/learnings/, details/requirements/)
- Request is obviously generic and repo context is not needed
- Most recent memory_reader YAML in conversation has same request content (avoid re-reading)

Step R3 Action (sync):
\`\`\`
proxy_task({
  subagent_type: "memory-reader",
  description: "Memory Bank context read",
  prompt: "Goal: Load minimum repo context needed for the user request.\\nConstraints:\\n- Read memory-bank/MEMORY.md first.\\n- Then read relevant files under memory-bank/details/ as needed.\\n- Do NOT read secrets (.env, *.pem, *.key).\\n- Max 10 files total.\\nOutput: ONE YAML block with selected_files, evidence, conflicts, context_pack.\\n\\nUser request:\\n<<<USER_REQUEST>>>"
})
\`\`\`
Replace <<<USER_REQUEST>>> with the user's original message verbatim.

---

AMENDMENT B — Final Step: Memory Bank Writer (Propose -> Confirm -> Execute)

Step W0 Timing:
- AFTER you finish main task output, RIGHT BEFORE final answer for this turn.

Step W1 Trigger (any):
- New requirement/scope/acceptance criteria clarified
- New technical decision/pattern/convention chosen or changed
- New learning/pitfall discovered (bug cause, integration trap, perf footgun)
- New/changed commands/workflow/project structure

Step W2 Skip (Loop Guards):
- Request is about Memory Bank itself (same keywords as R2)
- You already included "💾" or "Memory Bank" write prompt in this assistant message
- User already declined in this thread (不用/不要/跳过/no/skip/mb:no)
- User message is a confirmation or rejection (handle via W4 instead)
- Previous assistant message has write prompt and user hasn't responded yet

Step W3 Propose ONLY (do not write yet):
Append this at end of your answer (natural language, Chinese preferred):

\`\`\`
---
💾 要把这次的发现写入 Memory Bank 吗？
   → {target_file}
   → 内容：{要点1}；{要点2}

回复"好"或"写"即可，不需要可忽略。
---
\`\`\`

Step W4 On confirmation (next turn):
**Prerequisite**: Only interpret confirmation/rejection if your immediately previous message contained the 💾 write prompt block. Otherwise treat user message as normal conversation.

Confirmation words: 好/写/确认/可以/行/yes/ok/sure/mb:write
Rejection words: 不用/不要/跳过/算了/no/skip/mb:no
Ignore: User continues to next topic without addressing the prompt (treat as skip)

**Mixed intent**: If user confirms AND asks another question (e.g., "写吧，顺便问一下..."), execute the write first, then answer their question in the same response.

On confirmation, execute writer synchronously:
\`\`\`
proxy_task({
  subagent_type: "memory-bank-writer",
  description: "Memory Bank write (confirmed)",
  prompt: "You are updating Memory Bank.\\nConstraints:\\n- Edit ONLY the target file.\\n- Keep changes minimal and consistent with existing format.\\n- Do NOT invent facts.\\nInput:\\nTarget: <PASTE TARGET>\\nDraft:\\n1) <PASTE>\\n2) <PASTE>\\nOutput: Show what file changed + brief preview of changes."
})
\`\`\`

Step W5 After execution:
- Show which file(s) updated and brief preview.
- Do NOT emit another Proposal in same message.
${MEMORY_BANK_KEY_TRIGGER_END}`

interface OmoConfig {
  agents?: {
    sisyphus?: {
      prompt_append?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

async function findOmoConfigPath(): Promise<string | null> {
  // Check project-level first, then user-level
  const projectPath = join(process.cwd(), ".opencode", "oh-my-opencode.json")
  const userPath = join(homedir(), ".config", "opencode", "oh-my-opencode.json")
  
  if (await exists(projectPath)) return projectPath
  if (await exists(userPath)) return userPath
  return null
}

async function injectOmoKeyTrigger(
  undoStack: UndoAction[]
): Promise<InstallResult> {
  const configPath = await findOmoConfigPath()
  
  if (!configPath) {
    return {
      step: "Oh-My-OpenCode integration",
      status: "skipped",
      details: "oh-my-opencode.json not found (not using oh-my-opencode)",
    }
  }
  
  let config: OmoConfig = {}
  try {
    const content = await fs.readFile(configPath, "utf-8")
    config = JSON.parse(content)
  } catch (err) {
    return {
      step: "Oh-My-OpenCode integration",
      status: "skipped",
      details: `Failed to parse ${configPath}: ${err}`,
    }
  }
  
  if (!config.agents) config.agents = {}
  
  const orchestrators = ["sisyphus", "atlas"] as const
  const injected: string[] = []
  
  for (const orchestrator of orchestrators) {
    const existingAppend = (config.agents as any)[orchestrator]?.prompt_append ?? ""
    
    if (!(config.agents as any)[orchestrator]) {
      (config.agents as any)[orchestrator] = {}
    }
    
    let newAppend: string
    
    // Check if we have sentineled block (new format)
    const beginIdx = existingAppend.indexOf(MEMORY_BANK_KEY_TRIGGER_BEGIN)
    const endIdx = existingAppend.indexOf(MEMORY_BANK_KEY_TRIGGER_END)
    
    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
      // Replace existing sentineled block
      const before = existingAppend.slice(0, beginIdx)
      const after = existingAppend.slice(endIdx + MEMORY_BANK_KEY_TRIGGER_END.length)
      newAppend = before + MEMORY_BANK_KEY_TRIGGER + after
      injected.push(`${orchestrator} (upgraded)`)
    } else if (existingAppend.includes(MEMORY_BANK_KEY_TRIGGER_MARKER)) {
      // Legacy block without sentinels - find and replace the whole section
      // Look for "### Memory Bank Key Triggers" and replace to the end of that block
      const markerIdx = existingAppend.indexOf(`### ${MEMORY_BANK_KEY_TRIGGER_MARKER}`)
      if (markerIdx !== -1) {
        // Keep content before the marker, replace with new block
        const before = existingAppend.slice(0, markerIdx)
        newAppend = before + MEMORY_BANK_KEY_TRIGGER
        injected.push(`${orchestrator} (migrated)`)
      } else {
        // Marker found but not in expected format, append new block
        newAppend = existingAppend + "\n" + MEMORY_BANK_KEY_TRIGGER
        injected.push(orchestrator)
      }
    } else {
      // No existing block, append new
      newAppend = existingAppend 
        ? existingAppend + "\n" + MEMORY_BANK_KEY_TRIGGER
        : MEMORY_BANK_KEY_TRIGGER
      injected.push(orchestrator)
    }
    
    ;(config.agents as any)[orchestrator].prompt_append = newAppend
  }
  
  if (injected.length === 0) {
    return {
      step: "Oh-My-OpenCode integration",
      status: "already-configured",
      details: "keyTrigger already injected to all orchestrators",
    }
  }
  
  const newContent = JSON.stringify(config, null, 2) + "\n"
  await atomicWriteFile(configPath, newContent, undoStack)
  
  return {
    step: "Oh-My-OpenCode integration",
    status: "updated",
    details: `Injected keyTrigger to ${injected.join(", ")} in ${configPath}`,
  }
}

// ============================================================================
// Cache Management
// ============================================================================

async function checkAndCleanOpenCodeCache(): Promise<{ cleaned: boolean; message?: string }> {
  const cacheDir = join(homedir(), ".cache", "opencode")
  const cachePackageJson = join(cacheDir, "package.json")
  const pkgCacheDir = join(cacheDir, "node_modules", "memory-bank-skill")
  const cacheNodeModulesPkg = join(pkgCacheDir, "package.json")
  
  if (!(await exists(cachePackageJson))) {
    return { cleaned: false }
  }
  
  try {
    const cacheDepContent = await fs.readFile(cachePackageJson, "utf-8")
    const cacheDep = JSON.parse(cacheDepContent)
    const recordedVersion = cacheDep.dependencies?.["memory-bank-skill"]
    
    if (!recordedVersion) {
      return { cleaned: false }
    }
    
    let actualVersion: string | null = null
    if (await exists(cacheNodeModulesPkg)) {
      try {
        const actualPkg = JSON.parse(await fs.readFile(cacheNodeModulesPkg, "utf-8"))
        actualVersion = actualPkg.version
      } catch {}
    }
    
    const needsClean = 
      recordedVersion === "latest" ||
      recordedVersion !== VERSION ||
      (actualVersion && actualVersion !== VERSION)
    
    if (needsClean) {
      const realCacheDir = await fs.realpath(cacheDir).catch(() => null)
      const expectedPrefix = join(homedir(), ".cache", "opencode")
      if (!realCacheDir || !realCacheDir.startsWith(expectedPrefix)) {
        return { cleaned: false }
      }
      
      if (await exists(pkgCacheDir)) {
        await fs.rm(pkgCacheDir, { recursive: true, force: true })
      }
      
      const bunLockb = join(cacheDir, "bun.lockb")
      if (await exists(bunLockb)) {
        await fs.rm(bunLockb, { force: true })
      }
      
      const newDeps = { ...cacheDep.dependencies }
      delete newDeps["memory-bank-skill"]
      cacheDep.dependencies = newDeps
      
      const tmpPath = `${cachePackageJson}.tmp`
      await fs.writeFile(tmpPath, JSON.stringify(cacheDep, null, 2) + "\n")
      await fs.rename(tmpPath, cachePackageJson)
      
      const reason = recordedVersion === "latest" 
        ? `"latest" → ${VERSION}` 
        : `${recordedVersion} → ${VERSION}`
      return { 
        cleaned: true, 
        message: `Cleaned stale OpenCode cache (${reason})` 
      }
    }
  } catch {
    return { cleaned: false }
  }
  
  return { cleaned: false }
}

// ============================================================================
// Main Commands
// ============================================================================

async function install(customModel?: string): Promise<void> {
  log(`\n${colors.bold}Memory Bank Skill Installer v${VERSION}${colors.reset}\n`)

  const packageRoot = getPackageRoot()
  const undoStack: UndoAction[] = []
  const manifestFiles: { path: string; sha256: string }[] = []
  const results: InstallResult[] = []

  try {
    const cacheResult = await checkAndCleanOpenCodeCache()
    if (cacheResult.cleaned) {
      logSuccess(cacheResult.message || "Cleaned OpenCode cache")
      log("")
    }
    
    logStep(1, 4, "Installing skill files...")
    const r1 = await installSkillFiles(packageRoot, undoStack, manifestFiles)
    logDetail(r1.details || "")
    results.push(r1)

    logStep(2, 4, "Installing slash commands...")
    const r2 = await installCommands(undoStack, manifestFiles)
    logDetail(r2.details || "")
    results.push(r2)

    logStep(3, 4, "Configuring plugin...")
    const r3 = await installPluginToConfig(undoStack, customModel)
    logDetail(r3.details || "")
    results.push(r3)

    logStep(4, 4, "Oh-My-OpenCode integration...")
    const r4 = await injectOmoKeyTrigger(undoStack)
    logDetail(r4.details || "")
    results.push(r4)

    await writeManifest(manifestFiles, undoStack)
    await cleanupBackups(undoStack)

    const allSkipped = results.every((r) => r.status === "already-configured" || r.status === "skipped")

    log("")
    if (allSkipped) {
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

  let allOk = true

  const skillPath = join(homedir(), ".config", "opencode", "skills", "memory-bank", "SKILL.md")
  const skillOk = await exists(skillPath)
  if (skillOk) {
    log(`${colors.green}✓${colors.reset} Skill files`)
    logDetail(skillPath)
  } else {
    log(`${colors.red}✗${colors.reset} Skill files`)
    logDetail(`Missing: ${skillPath}`)
    allOk = false
  }

  const commandPath = join(homedir(), ".config", "opencode", "commands", "memory-bank-refresh.md")
  const commandOk = await exists(commandPath)
  if (commandOk) {
    log(`${colors.green}✓${colors.reset} Slash command`)
    logDetail(commandPath)
  } else {
    log(`${colors.red}✗${colors.reset} Slash command`)
    logDetail(`Missing: ${commandPath}`)
    allOk = false
  }

  const configPath = join(homedir(), ".config", "opencode", "opencode.json")
  let pluginConfigured = false
  let pluginVersion = ""
  if (await exists(configPath)) {
    try {
      const content = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(content)
      if (Array.isArray(config.plugin)) {
        const entry = config.plugin.find((p: string) => 
          p === "memory-bank-skill" || p.startsWith("memory-bank-skill@")
        )
        if (entry) {
          pluginConfigured = true
          pluginVersion = entry
        }
      }
    } catch {}
  }
  if (pluginConfigured) {
    log(`${colors.green}✓${colors.reset} Plugin configured in opencode.json`)
    logDetail(pluginVersion)
    if (!pluginVersion.includes("@")) {
      log(`${colors.yellow}⚠${colors.reset} Consider using pinned version: memory-bank-skill@${VERSION}`)
    }
  } else {
    log(`${colors.red}✗${colors.reset} Plugin not configured`)
    logDetail(`Add 'memory-bank-skill@${VERSION}' to plugin array in opencode.json`)
    allOk = false
  }
  
  const cacheDir = join(homedir(), ".cache", "opencode")
  const cachePackageJson = join(cacheDir, "package.json")
  if (await exists(cachePackageJson)) {
    try {
      const content = await fs.readFile(cachePackageJson, "utf-8")
      const cacheDep = JSON.parse(content)
      const recordedVersion = cacheDep.dependencies?.["memory-bank-skill"]
      if (recordedVersion) {
        const cacheNodeModules = join(cacheDir, "node_modules", "memory-bank-skill", "package.json")
        if (await exists(cacheNodeModules)) {
          const actualPkg = JSON.parse(await fs.readFile(cacheNodeModules, "utf-8"))
          if (recordedVersion !== actualPkg.version && recordedVersion !== "latest") {
            log(`${colors.yellow}⚠${colors.reset} OpenCode cache version mismatch`)
            logDetail(`Recorded: ${recordedVersion}, Actual: ${actualPkg.version}`)
            logDetail(`Run 'bunx memory-bank-skill install' to fix`)
          }
        }
      }
    } catch {}
  }

  const manifestPath = join(homedir(), ".config", "opencode", "skills", "memory-bank", ".manifest.json")
  if (await exists(manifestPath)) {
    try {
      const manifest: Manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
      log("")
      log(`${colors.dim}Installed version: ${manifest.version}${colors.reset}`)
      log(`${colors.dim}Installed at: ${manifest.installedAt}${colors.reset}`)
    } catch {}
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
  bunx memory-bank-skill <command> [options]

Commands:
  install    Install Memory Bank skill and plugin
  doctor     Check installation status

Options:
  --model <model>  Specify model for memory-bank-writer agent
                   Default: cliproxy/claude-opus-4-5-20251101

Examples:
  bunx memory-bank-skill install
  bunx memory-bank-skill install --model anthropic/claude-sonnet-4-5
  bunx memory-bank-skill doctor
`)
}

// ============================================================================
// Entry Point
// ============================================================================

function parseArgs(): { command?: string; model?: string } {
  const args = process.argv.slice(2)
  let command: string | undefined
  let model: string | undefined
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      model = args[++i]
    } else if (!args[i].startsWith("-")) {
      command = args[i]
    }
  }
  
  return { command, model }
}

const { command, model } = parseArgs()

switch (command) {
  case "install":
    install(model)
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
