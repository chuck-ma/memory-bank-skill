/**
 * Memory Bank Plugin (Unified)
 *
 * Combines two functions:
 * 1. Auto-inject Memory Bank content into system prompt (loader)
 * 2. Remind AI to update Memory Bank when session ends (reminder)
 */
import type { Plugin, PluginClient } from "@opencode-ai/plugin"
import { stat, readFile, access } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"

// ============================================================================
// Configuration
// ============================================================================

const DEBUG = process.env.MEMORY_BANK_DEBUG === "1"
const DEFAULT_MAX_CHARS = 12_000
const TRUNCATION_NOTICE =
  "\n\n---\n\n[TRUNCATED] Memory Bank context exceeded size limit. Read files directly for complete content."

const MEMORY_BANK_FILES = [
  "memory-bank/brief.md",
  "memory-bank/active.md",
  "memory-bank/_index.md",
] as const

const SENTINEL_OPEN = "<memory-bank-bootstrap>"
const SENTINEL_CLOSE = "</memory-bank-bootstrap>"

const SERVICE_NAME = "memory-bank"

// ============================================================================
// Types
// ============================================================================

interface RootState {
  filesModified: string[]
  hasNewRequirement: boolean
  hasTechDecision: boolean
  hasBugFix: boolean
  memoryBankUpdated: boolean
  reminderFired: boolean
  memoryBankReviewed: boolean
  skipInit: boolean
}

interface SessionMeta {
  rootsTouched: Set<string>
  lastActiveRoot: string | null
}

type LogLevel = "debug" | "info" | "warn" | "error"
type CacheEntry = { mtimeMs: number; text: string }

// ============================================================================
// Global State (shared between loader and reminder)
// ============================================================================

const rootStates = new Map<string, RootState>()
const sessionMetas = new Map<string, SessionMeta>()
const memoryBankExistsCache = new Map<string, boolean>()
const fileCache = new Map<string, CacheEntry>()

// ============================================================================
// Utilities
// ============================================================================

function makeStateKey(sessionId: string, root: string): string {
  return `${sessionId}::${root}`
}

function maxChars(): number {
  const raw = process.env.MEMORY_BANK_MAX_CHARS
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_CHARS
}

function createLogger(client: PluginClient) {
  let pending: Promise<void> = Promise.resolve()

  const formatArgs = (args: unknown[]): string => {
    return args
      .map((a) => {
        if (typeof a === "string") return a
        try {
          const str = JSON.stringify(a)
          return str.length > 2000 ? str.slice(0, 2000) + "..." : str
        } catch {
          return String(a)
        }
      })
      .join(" ")
  }

  const enqueue = (level: LogLevel, message: string) => {
    pending = pending
      .then(() =>
        client.app.log({
          body: { service: SERVICE_NAME, level, message },
        })
      )
      .catch(() => {})
  }

  return {
    debug: (...args: unknown[]) => {
      if (DEBUG) enqueue("debug", formatArgs(args))
    },
    info: (...args: unknown[]) => enqueue("info", formatArgs(args)),
    warn: (...args: unknown[]) => enqueue("warn", formatArgs(args)),
    error: (...args: unknown[]) => enqueue("error", formatArgs(args)),
    flush: () => pending,
  }
}

// ============================================================================
// Loader Functions
// ============================================================================

async function readTextCached(absPath: string): Promise<string | null> {
  try {
    const st = await stat(absPath)
    const cached = fileCache.get(absPath)
    if (cached && cached.mtimeMs === st.mtimeMs) return cached.text

    const text = await readFile(absPath, "utf8")
    fileCache.set(absPath, { mtimeMs: st.mtimeMs, text })
    return text
  } catch {
    return null
  }
}

function truncateToBudget(text: string, budget: number): string {
  if (text.length <= budget) return text
  const reserve = TRUNCATION_NOTICE.length
  if (budget <= reserve) return TRUNCATION_NOTICE.slice(0, budget)
  return text.slice(0, budget - reserve) + TRUNCATION_NOTICE
}

async function buildMemoryBankContext(projectRoot: string): Promise<string | null> {
  const parts: string[] = []

  for (const rel of MEMORY_BANK_FILES) {
    const abs = path.join(projectRoot, rel)
    const content = await readTextCached(abs)
    if (!content) continue
    const trimmed = content.trim()
    if (!trimmed) continue
    parts.push(`## ${rel}\n\n${trimmed}`)
  }

  if (parts.length === 0) return null

  const header =
    `# Memory Bank Bootstrap (Auto-injected by OpenCode plugin)\n\n` +
    `Use \`memory-bank/_index.md\` to locate additional context files.\n` +
    `Read more files from \`memory-bank/\` as needed based on the task.\n\n` +
    `---\n\n`

  const wrapped =
    `${SENTINEL_OPEN}\n` +
    header +
    parts.join("\n\n---\n\n") +
    `\n${SENTINEL_CLOSE}`

  return truncateToBudget(wrapped, maxChars())
}

// ============================================================================
// Reminder Functions
// ============================================================================

async function checkMemoryBankExists(
  root: string,
  log: ReturnType<typeof createLogger>
): Promise<boolean> {
  if (memoryBankExistsCache.has(root)) {
    const cached = memoryBankExistsCache.get(root)!
    if (cached) {
      log.debug("memoryBankExists cache hit (true):", root)
      return true
    }
  }

  try {
    const mbPath = path.join(root, "memory-bank")
    await stat(mbPath)
    memoryBankExistsCache.set(root, true)
    log.debug("memoryBankExists check: true for", root)
    return true
  } catch {
    memoryBankExistsCache.set(root, false)
    log.debug("memoryBankExists check: false for", root)
    return false
  }
}

function getSessionMeta(sessionId: string, fallbackRoot: string): SessionMeta {
  let meta = sessionMetas.get(sessionId)
  if (!meta) {
    meta = { rootsTouched: new Set(), lastActiveRoot: fallbackRoot }
    sessionMetas.set(sessionId, meta)
  }
  return meta
}

function getRootState(sessionId: string, root: string): RootState {
  const key = makeStateKey(sessionId, root)
  let state = rootStates.get(key)
  if (!state) {
    state = {
      filesModified: [],
      hasNewRequirement: false,
      hasTechDecision: false,
      hasBugFix: false,
      memoryBankUpdated: false,
      reminderFired: false,
      memoryBankReviewed: false,
      skipInit: false,
    }
    rootStates.set(key, state)
  }
  return state
}

const TRACKABLE_FILE_PATTERNS = [
  /\.py$/,
  /\.ts$/,
  /\.tsx$/,
  /\.js$/,
  /\.jsx$/,
  /\.go$/,
  /\.rs$/,
  /\.md$/,
  /\.json$/,
  /\.yaml$/,
  /\.yml$/,
  /\.toml$/,
  /\.css$/,
  /\.scss$/,
  /\.html$/,
  /\.vue$/,
  /\.svelte$/,
]

const EXCLUDED_DIRS = [
  /^node_modules\//,
  /^\.venv\//,
  /^venv\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^\.nuxt\//,
  /^coverage\//,
  /^\.pytest_cache\//,
  /^__pycache__\//,
  /^\.git\//,
  /^\.opencode\//,
  /^\.claude\//,
]

const MEMORY_BANK_PATTERN = /^memory-bank\//

function isDisabled(): boolean {
  return process.env.MEMORY_BANK_DISABLED === "1" || process.env.MEMORY_BANK_DISABLED === "true"
}

// ============================================================================
// Git-based Change Detection
// ============================================================================

interface GitChanges {
  modifiedFiles: string[]
  memoryBankUpdated: boolean
}

function detectGitChanges(
  root: string,
  log: ReturnType<typeof createLogger>
): GitChanges | null {
  try {
    const stdout = execSync("git status --porcelain", {
      cwd: root,
      timeout: 5000,
      encoding: "utf8",
    })

    if (!stdout.trim()) {
      log.debug("No git changes detected in", root)
      return { modifiedFiles: [], memoryBankUpdated: false }
    }

    const lines = stdout.replace(/[\r\n]+$/, "").split(/\r?\n/)
    const modifiedFiles: string[] = []
    let memoryBankUpdated = false

    for (const line of lines) {
      if (line.length < 4) continue

      const x = line[0]
      const y = line[1]
      let payload = line.slice(3)

      if (!payload) continue

      if (payload.startsWith('"') && payload.endsWith('"')) {
        payload = payload.slice(1, -1)
      }

      if ((x === "R" || x === "C") && payload.includes(" -> ")) {
        payload = payload.split(" -> ")[1]
      }

      const relativePath = payload.replace(/\\/g, "/")

      // Check if it's a memory-bank file
      if (MEMORY_BANK_PATTERN.test(relativePath)) {
        memoryBankUpdated = true
        log.debug("Git detected memory-bank update:", relativePath)
        continue
      }

      // Check if it's a trackable file (by extension)
      if (TRACKABLE_FILE_PATTERNS.some((p) => p.test(relativePath))) {
        // Skip excluded directories
        if (!EXCLUDED_DIRS.some((p) => p.test(relativePath))) {
          const absPath = path.join(root, relativePath)
          modifiedFiles.push(absPath)
          log.debug("Git detected modified file:", relativePath)
        }
      }
    }

    log.info("Git changes detected", {
      root,
      modifiedCount: modifiedFiles.length,
      memoryBankUpdated,
    })

    return { modifiedFiles, memoryBankUpdated }
  } catch (err) {
    // Not a git repo or git not available
    log.debug("Git detection failed (not a git repo?):", String(err))
    return null
  }
}

// ============================================================================
// Plugin Entry Point
// ============================================================================

const plugin: Plugin = async ({ client, directory, worktree }) => {
  const projectRoot = worktree || directory
  const log = createLogger(client)

  log.info("Plugin initialized (unified)", { projectRoot })

  async function evaluateAndFireReminder(sessionId: string): Promise<void> {
    if (isDisabled()) {
      log.info("[SESSION_IDLE DECISION]", { sessionId, decision: "SKIP", reason: "MEMORY_BANK_DISABLED is set" })
      return
    }

    const gitChanges = detectGitChanges(projectRoot, log)
    if (!gitChanges) {
      log.info("[SESSION_IDLE DECISION]", { sessionId, decision: "SKIP", reason: "not a git repo" })
      return
    }

    const { modifiedFiles, memoryBankUpdated: gitMemoryBankUpdated } = gitChanges
    const state = getRootState(sessionId, projectRoot)

    if (gitMemoryBankUpdated) {
      state.memoryBankUpdated = true
    }
    state.filesModified = modifiedFiles

    memoryBankExistsCache.delete(projectRoot)
    const hasMemoryBank = await checkMemoryBankExists(projectRoot, log)

    const decisionContext = {
      sessionId,
      root: projectRoot,
      projectName: path.basename(projectRoot),
      filesModified: state.filesModified.length,
      hasMemoryBank,
      memoryBankUpdated: state.memoryBankUpdated,
      reminderFired: state.reminderFired,
      memoryBankReviewed: state.memoryBankReviewed,
      skipInit: state.skipInit,
      hasNewRequirement: state.hasNewRequirement,
      hasTechDecision: state.hasTechDecision,
      hasBugFix: state.hasBugFix,
    }

    if (state.memoryBankUpdated) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "memoryBankUpdated is true" })
      return
    }
    if (state.memoryBankReviewed) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "memoryBankReviewed escape valve active" })
      return
    }
    if (state.reminderFired) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "reminderFired already true" })
      return
    }

    if (!hasMemoryBank) {
      if (state.skipInit) {
        log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "skipInit escape valve active" })
        return
      }
      if (state.filesModified.length >= 1) {
        state.reminderFired = true
        log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "FIRE_INIT", reason: `${state.filesModified.length} files modified, no memory-bank` })

        // Check if project has git initialized
        const hasGit = await (async () => {
          try {
            await stat(path.join(projectRoot, ".git"))
            return true
          } catch {
            return false
          }
        })()

        const gitInitStep = hasGit
          ? ""
          : "1. 执行 `git init`（项目尚未初始化 Git）\n"
        const stepOffset = hasGit ? 0 : 1

        try {
          await client.session.prompt({
            path: { id: sessionId },
            body: {
              parts: [{
                type: "text",
                text: `## [SYSTEM REMINDER - Memory Bank Init]\n\n项目 \`${path.basename(projectRoot)}\` 尚未初始化 Memory Bank，但本轮修改了 ${state.filesModified.length} 个文件。\n\n**项目路径**：\`${projectRoot}\`\n\n**将要执行的操作**：\n${gitInitStep}${stepOffset + 1}. 创建 \`memory-bank/\` 目录\n${stepOffset + 2}. 扫描项目结构（README.md、package.json 等）\n${stepOffset + 3}. 生成 \`memory-bank/brief.md\`（项目概述）\n${stepOffset + 4}. 生成 \`memory-bank/tech.md\`（技术栈）\n${stepOffset + 5}. 生成 \`memory-bank/_index.md\`（索引）\n\n**操作选项**：\n1. 如需初始化 → 回复确认，我将执行上述操作\n2. 如不需要 → 回复"跳过初始化"\n\n注意：这是系统自动提醒，不是用户消息。`,
              }],
            },
          })
          log.info("INIT reminder sent successfully", { sessionId, root: projectRoot })
        } catch (promptErr) {
          log.error("Failed to send INIT reminder:", String(promptErr))
        }
      } else {
        log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "NO_TRIGGER", reason: "no memory-bank and no files modified" })
      }
      return
    }

    const triggers: string[] = []
    if (state.hasNewRequirement) triggers.push("- 检测到新需求讨论 → 考虑创建 requirements/REQ-xxx.md")
    if (state.hasTechDecision) triggers.push("- 检测到技术决策 → 考虑更新 patterns.md")
    if (state.hasBugFix) triggers.push("- 检测到 Bug 修复/踩坑 → 考虑记录到 learnings/")
    if (state.filesModified.length >= 1) triggers.push(`- 本轮修改了 ${state.filesModified.length} 个文件 → 考虑更新 active.md`)

    if (triggers.length > 0) {
      state.reminderFired = true
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "FIRE_UPDATE", reason: `${triggers.length} triggers detected`, triggers })
      try {
        await client.session.prompt({
          path: { id: sessionId },
          body: {
            parts: [{
              type: "text",
              text: `## [SYSTEM REMINDER - Memory Bank Check]\n\n项目 \`${path.basename(projectRoot)}\` 本轮检测到以下事件，请确认是否需要更新 Memory Bank：\n\n**项目路径**：\`${projectRoot}\`\n\n${triggers.join("\n")}\n\n**操作选项**：\n1. 如需更新 → 输出更新计划，等用户确认后执行\n2. 如不需要 → 回复"无需更新"后结束\n\n注意：这是系统自动提醒，不是用户消息。`,
            }],
          },
        })
        log.info("UPDATE reminder sent successfully", { sessionId, root: projectRoot })
      } catch (promptErr) {
        log.error("Failed to send UPDATE reminder:", String(promptErr))
      }
    } else {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "NO_TRIGGER", reason: "has memory-bank but no triggers" })
    }
  }

  return {
    // ========================================================================
    // Loader Hooks: Auto-inject Memory Bank into system prompt
    // ========================================================================

    "experimental.chat.system.transform": async (_input, output) => {
      if (output.system.some((s) => s.includes(SENTINEL_OPEN))) return

      const ctx = await buildMemoryBankContext(projectRoot)
      if (!ctx) return

      output.system.push(ctx)
    },

    "experimental.session.compacting": async (_input, output) => {
      if (output.context.some((s) => s.includes(SENTINEL_OPEN))) return

      const ctx = await buildMemoryBankContext(projectRoot)
      if (!ctx) return

      output.context.push(ctx)
    },

    // ========================================================================
    // Reminder Hooks: Track changes and remind to update Memory Bank
    // ========================================================================

    event: async ({ event }) => {
      try {
        // Extract sessionId based on event type:
        // - session.created/deleted: event.properties.info.id (Session object)
        // - message.updated: event.properties.info.sessionID (Message object)
        let sessionId: string | undefined
        const props = (event as any).properties
        const info = props?.info

        if (event.type === "session.created" || event.type === "session.deleted") {
          sessionId = info?.id
        } else if (event.type === "message.updated") {
          sessionId = info?.sessionID
        } else {
          // Fallback for other event types
          sessionId = info?.sessionID || info?.id || props?.sessionID || props?.session_id
        }

        if (!sessionId) {
          log.debug("event handler: no sessionId in event", event.type, JSON.stringify(props || {}).slice(0, 200))
          return
        }

        if (event.type === "session.created") {
          sessionMetas.set(sessionId, { rootsTouched: new Set(), lastActiveRoot: projectRoot })
          log.info("Session created", { sessionId })
        }

        if (event.type === "session.deleted") {
          const meta = sessionMetas.get(sessionId)
          if (meta) {
            for (const root of meta.rootsTouched) {
              rootStates.delete(makeStateKey(sessionId, root))
            }
          }
          sessionMetas.delete(sessionId)
          log.info("Session deleted", { sessionId })
        }

        if (event.type === "message.updated") {
          const message = info // info IS the message for message.updated
          if (message?.role === "user") {
            const content = JSON.stringify(message.content || "").toLowerCase()
            const meta = getSessionMeta(sessionId, projectRoot)
            const targetRoot = meta.lastActiveRoot || projectRoot
            const state = getRootState(sessionId, targetRoot)

            if (/新需求|new req|feature request|需要实现|要做一个/.test(content)) {
              state.hasNewRequirement = true
              state.reminderFired = false
              log.debug("Keyword detected: newRequirement", { sessionId, root: targetRoot })
            }

            if (/决定用|选择了|我们用|技术选型|architecture|决策/.test(content)) {
              state.hasTechDecision = true
              state.reminderFired = false
              log.debug("Keyword detected: techDecision", { sessionId, root: targetRoot })
            }

            if (/bug|修复|fix|问题|error|踩坑|教训/.test(content)) {
              state.hasBugFix = true
              state.reminderFired = false
              log.debug("Keyword detected: bugFix", { sessionId, root: targetRoot })
            }

            if (/memory.?bank.?reviewed|无需更新|不需要更新|已检查/.test(content)) {
              state.memoryBankReviewed = true
              log.info("Escape valve triggered: memoryBankReviewed", { sessionId, root: targetRoot })
            }
            if (/跳过初始化|skip.?init/.test(content)) {
              state.skipInit = true
              log.info("Escape valve triggered: skipInit", { sessionId, root: targetRoot })
            }
          }
        }

        if (event.type === "session.idle") {
          log.info("Session idle event received", { sessionId })
          await evaluateAndFireReminder(sessionId)
        }

        if (event.type === "session.status") {
          const status = (event as any).properties?.status
          if (status?.type === "idle") {
            log.info("Session status idle received", { sessionId })
            await evaluateAndFireReminder(sessionId)
          }
        }
      } catch (err) {
        log.error("event handler error:", String(err))
      }
    },
  }
}

export default plugin
