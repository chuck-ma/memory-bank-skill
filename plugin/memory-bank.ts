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
const PLUGIN_PROMPT_VARIANT = "memory-bank-plugin"

// ============================================================================
// Types
// ============================================================================

interface RootState {
  filesModified: string[]
  hasNewRequirement: boolean
  hasTechDecision: boolean
  hasBugFix: boolean
  memoryBankReviewed: boolean
  skipInit: boolean
  initReminderFired: boolean
  lastUpdateReminderSignature?: string
  lastSyncedTriggerSignature?: string
}

interface SessionMeta {
  rootsTouched: Set<string>
  lastActiveRoot: string | null
  notifiedMessageIds: Set<string>
  planOutputted: boolean
  promptInProgress: boolean  // Prevent re-entrancy during prompt calls
  userMessageReceived: boolean  // Track if a new user message was received since last reminder
  sessionNotified: boolean  // Track if context notification was already sent this session
  userMessageSeq: number
  lastUserMessageDigest?: string
  lastUserMessageAt?: number
  lastUserMessageKey?: string
}

interface MemoryBankContextResult {
  text: string
  files: { relPath: string; chars: number }[]
  totalChars: number
  truncated: boolean
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

function isPluginGeneratedPrompt(
  message: { variant?: string; agent?: string } | undefined,
  content: string
): boolean {
  if (message?.variant === PLUGIN_PROMPT_VARIANT) return true
  return content.includes("## [Memory Bank]") || content.includes("## [SYSTEM REMINDER - Memory Bank")
}

function getMessageKey(message: any, rawContent: string): string | null {
  const id = message?.id || message?.messageID
  if (id) return String(id)
  const created = message?.time?.created
  if (typeof created === "number") return `ts:${created}`
  const trimmed = rawContent.trim()
  if (trimmed) return `content:${trimmed.slice(0, 200)}`
  return null
}

function getOrCreateMessageKey(
  meta: SessionMeta,
  message: any,
  rawContent: string
): string | null {
  const directKey = getMessageKey(message, rawContent)
  if (directKey && !directKey.startsWith("content:")) return directKey

  const trimmed = rawContent.trim()
  if (!trimmed) return directKey ?? null

  const now = Date.now()
  const digest = trimmed.slice(0, 200)
  const sameAsLast = meta.lastUserMessageDigest === digest
  const withinWindow = typeof meta.lastUserMessageAt === "number" && now - meta.lastUserMessageAt < 2000

  if (sameAsLast && withinWindow && meta.lastUserMessageKey) {
    return meta.lastUserMessageKey
  }

  meta.userMessageSeq += 1
  const key = `seq:${meta.userMessageSeq}`
  meta.lastUserMessageDigest = digest
  meta.lastUserMessageAt = now
  meta.lastUserMessageKey = key
  return key
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
      .catch(() => { })
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

async function buildMemoryBankContextWithMeta(projectRoot: string): Promise<MemoryBankContextResult | null> {
  const parts: string[] = []
  const files: { relPath: string; chars: number }[] = []

  for (const rel of MEMORY_BANK_FILES) {
    const abs = path.join(projectRoot, rel)
    const content = await readTextCached(abs)
    if (!content) continue
    const trimmed = content.trim()
    if (!trimmed) continue
    parts.push(`## ${rel}\n\n${trimmed}`)
    files.push({ relPath: rel, chars: trimmed.length })
  }

  if (parts.length === 0) return null

  const fileList = files.map(f => f.relPath.replace("memory-bank/", "")).join(", ")
  const totalChars = files.reduce((sum, f) => sum + f.chars, 0)

  const header =
    `# Memory Bank Bootstrap (Auto-injected by OpenCode plugin)\n\n` +
    `Use \`memory-bank/_index.md\` to locate additional context files.\n` +
    `Read more files from \`memory-bank/\` as needed based on the task.\n\n` +
    `**AI 行为指令**：\n` +
    `- 每次回复末尾加一行确认：\`| 📚 Memory Bank | ${fileList} (${totalChars.toLocaleString()} chars) |\`\n` +
`- **文档驱动开发（核心原则）**：\n` +
    `  - 方案讨论完成后，**先写设计文档到 memory-bank/docs/，再写代码**\n` +
    `  - 设计文档是契约，代码实现要符合文档\n` +
    `  - 实现完成后回顾：如有偏差，决定是改文档还是改实现\n` +
`- **写入触发场景**（语义判断，非关键词匹配）：\n` +
    `  - 方案讨论确定（\"那就这样吧\"、\"OK就这么做\"、\"方案确定\"）→ **先写** memory-bank/docs/design-xxx.md\n` +
    `  - 用户描述新功能/需求（\"我需要...\"、\"能不能加...\"、\"帮我做...\"、\"要实现...\"）→ requirements/\n` +
    `  - 用户做出技术选型（\"我们用 X 吧\"、\"决定采用...\"、\"选择...\"）→ patterns.md\n` +
    `  - 修复了 bug 或踩坑经验（\"原来问题是...\"、\"这个坑是...\"、\"发现...\"）→ learnings/\n` +
    `  - AI 修改了代码/配置文件 → active.md（如涉及 bug 修复则同时 learnings/）\n` +
    `  - 当前任务完成，焦点切换 → active.md\n` +
`- **Todo 创建规则（必须）**：\n` +
    `  - 方案讨论完成后开始落地：第一项必须是\"写入设计文档到 memory-bank/docs/\"\n` +
    `  - 最后一项必须是\"更新 Memory Bank\"（检查触发场景并更新相应文件）\n\n` +
    `---\n\n`

  const wrapped =
    `${SENTINEL_OPEN}\n` +
    header +
    parts.join("\n\n---\n\n") +
    `\n${SENTINEL_CLOSE}`

  const budget = maxChars()
  const truncated = wrapped.length > budget
  const text = truncateToBudget(wrapped, budget)
  return { text, files, totalChars, truncated }
}

async function buildMemoryBankContext(projectRoot: string): Promise<string | null> {
  const result = await buildMemoryBankContextWithMeta(projectRoot)
  return result?.text ?? null
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
    meta = { rootsTouched: new Set(), lastActiveRoot: fallbackRoot, notifiedMessageIds: new Set(), planOutputted: false, promptInProgress: false, userMessageReceived: false, sessionNotified: false, userMessageSeq: 0 }
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
      memoryBankReviewed: false,
      skipInit: false,
      initReminderFired: false,
      lastUpdateReminderSignature: undefined,
      lastSyncedTriggerSignature: undefined,
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

function computeTriggerSignature(state: RootState): string {
  return JSON.stringify({
    files: [...state.filesModified].sort(),
    flags: {
      hasNewRequirement: state.hasNewRequirement,
      hasTechDecision: state.hasTechDecision,
      hasBugFix: state.hasBugFix,
    }
  })
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

  async function sendContextNotification(
    sessionId: string,
    messageKey: string,
    messageId?: string
  ): Promise<void> {
    if (isDisabled()) return

    const meta = getSessionMeta(sessionId, projectRoot)

    // Prevent re-entrancy: skip if a prompt is already in progress
    if (meta.promptInProgress) {
      log.debug("Context notification skipped (prompt in progress)", { sessionId, messageId })
      return
    }

    // Only notify once per user message (using messageId to deduplicate)
    if (meta.notifiedMessageIds.has(messageKey)) {
      log.debug("Context notification skipped (already notified for this message)", { sessionId, messageKey, messageId })
      return
    }

    const result = await buildMemoryBankContextWithMeta(projectRoot)
    if (!result) {
      log.debug("Context notification skipped (no memory-bank)", { sessionId })
      return
    }

    const fileList = result.files.map(f => f.relPath.replace("memory-bank/", "")).join(", ")
    const truncatedNote = result.truncated ? " (truncated)" : ""

    const text = `## [Memory Bank]

**已读取 Memory Bank 文件**: ${fileList} (${result.totalChars.toLocaleString()} chars)${truncatedNote}

**写入提醒**：如果本轮涉及以下事件，工作完成后输出更新计划：
- 新需求 → requirements/
- 技术决策 → patterns.md
- Bug修复/踩坑 → learnings/
- 焦点变更 → active.md

操作：请加载 memory-bank skill，按规范输出更新计划或更新内容（无需 slash command）。`

    try {
      meta.promptInProgress = true
      await client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: false,
          variant: PLUGIN_PROMPT_VARIANT,
          parts: [{ type: "text", text }],
        },
      })
      meta.notifiedMessageIds.add(messageKey)
      meta.sessionNotified = true  // Mark session as notified
      if (meta.notifiedMessageIds.size > 100) {
        const first = meta.notifiedMessageIds.values().next().value
        if (first) meta.notifiedMessageIds.delete(first)
      }
      log.info("Context notification sent", { sessionId, messageKey, messageId, files: result.files.length, totalChars: result.totalChars })
    } catch (err) {
      log.error("Failed to send context notification:", String(err))
    } finally {
      meta.promptInProgress = false
    }
  }

  async function evaluateAndFireReminder(sessionId: string): Promise<void> {
    if (isDisabled()) {
      log.info("[SESSION_IDLE DECISION]", { sessionId, decision: "SKIP", reason: "MEMORY_BANK_DISABLED is set" })
      return
    }

    const meta = getSessionMeta(sessionId, projectRoot)

    // Prevent re-entrancy: skip if a prompt is already in progress
    if (meta.promptInProgress) {
      log.info("[SESSION_IDLE DECISION]", { sessionId, decision: "SKIP", reason: "prompt already in progress" })
      return
    }

    const gitChanges = detectGitChanges(projectRoot, log)
    const isGitRepo = gitChanges !== null
    const state = getRootState(sessionId, projectRoot)

    if (gitChanges) {
      const { modifiedFiles, memoryBankUpdated: gitMemoryBankUpdated } = gitChanges
      state.filesModified = modifiedFiles
      if (gitMemoryBankUpdated) {
        state.lastSyncedTriggerSignature = computeTriggerSignature(state)
      }
    }

    memoryBankExistsCache.delete(projectRoot)
    const hasMemoryBank = await checkMemoryBankExists(projectRoot, log)

    const triggerSignature = computeTriggerSignature(state)
    const decisionContext = {
      sessionId,
      root: projectRoot,
      projectName: path.basename(projectRoot),
      isGitRepo,
      filesModified: state.filesModified.length,
      hasMemoryBank,
      initReminderFired: state.initReminderFired,
      lastUpdateReminderSignature: state.lastUpdateReminderSignature,
      lastSyncedTriggerSignature: state.lastSyncedTriggerSignature,
      triggerSignature,
      memoryBankReviewed: state.memoryBankReviewed,
      skipInit: state.skipInit,
      hasNewRequirement: state.hasNewRequirement,
      hasTechDecision: state.hasTechDecision,
      hasBugFix: state.hasBugFix,
    }

    if (state.memoryBankReviewed) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "memoryBankReviewed escape valve active" })
      return
    }

    if (!hasMemoryBank) {
      if (state.skipInit) {
        log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "skipInit escape valve active" })
        return
      }
      if (state.initReminderFired) {
        log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "initReminderFired already true" })
        return
      }

      state.initReminderFired = true
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "FIRE_INIT", reason: "no memory-bank directory" })

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
        meta.promptInProgress = true
        await client.session.prompt({
          path: { id: sessionId },
          body: {
            noReply: true,
            variant: PLUGIN_PROMPT_VARIANT,
            parts: [{
              type: "text",
              text: `## [SYSTEM REMINDER - Memory Bank Init]\n\n项目 \`${path.basename(projectRoot)}\` 尚未初始化 Memory Bank。\n\n**项目路径**：\`${projectRoot}\`\n\n**将要执行的操作**：\n${gitInitStep}${stepOffset + 1}. 创建 \`memory-bank/\` 目录\n${stepOffset + 2}. 扫描项目结构（README.md、package.json 等）\n${stepOffset + 3}. 生成 \`memory-bank/brief.md\`（项目概述）\n${stepOffset + 4}. 生成 \`memory-bank/tech.md\`（技术栈）\n${stepOffset + 5}. 生成 \`memory-bank/_index.md\`（索引）\n\n**操作选项**：\n1. 如需初始化 → 回复"初始化"\n2. 如需初始化并提交 → 回复"初始化并提交"\n3. 如不需要 → 回复"跳过初始化"\n\n注意：这是系统自动提醒，不是用户消息。`,
            }],
          },
        })
        log.info("INIT reminder sent successfully", { sessionId, root: projectRoot })
      } catch (promptErr) {
        log.error("Failed to send INIT reminder:", String(promptErr))
      } finally {
        meta.promptInProgress = false
      }
      return
    }

    state.initReminderFired = false

    const triggers: string[] = []
    if (state.hasNewRequirement) triggers.push("- 检测到新需求讨论")
    if (state.hasTechDecision) triggers.push("- 检测到技术决策")
    if (state.hasBugFix) triggers.push("- 检测到 Bug 修复/踩坑")

    const modifiedFilesRelative = state.filesModified.map(abs => path.relative(projectRoot, abs))
    const displayFiles = modifiedFilesRelative.slice(0, 5)
    const moreCount = modifiedFilesRelative.length - 5

    let filesSection = ""
    if (modifiedFilesRelative.length > 0) {
      triggers.push("- 代码文件变更")
      filesSection = `\n**变更文件**：\n${displayFiles.map(f => `- ${f}`).join("\n")}${moreCount > 0 ? `\n(+${moreCount} more)` : ""}\n`
    }

    if (triggers.length === 0) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "NO_TRIGGER", reason: "has memory-bank but no triggers" })
      return
    }

    if (meta.planOutputted) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "AI already outputted update plan" })
      return
    }

    if (triggerSignature === state.lastSyncedTriggerSignature) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "already synced (signature matches lastSyncedTriggerSignature)" })
      return
    }

    if (triggerSignature === state.lastUpdateReminderSignature) {
      log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "SKIP", reason: "already reminded (signature matches lastUpdateReminderSignature)" })
      return
    }

    state.lastUpdateReminderSignature = triggerSignature
    log.info("[SESSION_IDLE DECISION]", { ...decisionContext, decision: "FIRE_UPDATE", reason: `${triggers.length} triggers detected`, triggers })

    try {
      meta.promptInProgress = true
      await client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: true,
          variant: PLUGIN_PROMPT_VARIANT,
          parts: [{
            type: "text",
            text: `## [SYSTEM REMINDER - Memory Bank Update]\n\n本轮检测到以下变更：${filesSection}\n**触发事件**：\n${triggers.join("\n")}\n\n**操作选项**：\n1. 如需更新 → 回复"更新"，输出更新计划\n2. 如需更新并提交 → 回复"更新并提交"\n3. 如不需要 → 回复"跳过"`,
          }],
        },
      })
      log.info("UPDATE reminder sent successfully", { sessionId, root: projectRoot })
    } catch (promptErr) {
      log.error("Failed to send UPDATE reminder:", String(promptErr))
    } finally {
      meta.promptInProgress = false
    }
  }

  return {
    // ========================================================================
    // Loader Hooks: Auto-inject Memory Bank into system prompt
    // ========================================================================

    "experimental.chat.system.transform": async (_input, output) => {
      if (output.system.some((s) => s.includes(SENTINEL_OPEN))) return

      const ctx = await buildMemoryBankContext(projectRoot)
      if (ctx) {
        output.system.push(ctx)
        return
      }

      // No memory-bank exists - inject init instruction
      const initInstruction =
        `${SENTINEL_OPEN}\n` +
        `# Memory Bank 未初始化\n\n` +
        `项目 \`${path.basename(projectRoot)}\` 尚未初始化 Memory Bank。\n\n` +
        `**AI 行为指令**：\n` +
        `- **Todo 创建规则（必须）**：创建 todo 时，第一项必须是"初始化 Memory Bank"（扫描项目结构，创建 brief.md + tech.md + _index.md），最后一项必须是"更新 Memory Bank"（更新 active.md）\n` +
        `${SENTINEL_CLOSE}`
      output.system.push(initInstruction)
    },

    "experimental.session.compacting": async (_input, output) => {
      if (output.context.some((s) => s.includes(SENTINEL_OPEN))) return

      const ctx = await buildMemoryBankContext(projectRoot)
      if (ctx) {
        output.context.push(ctx)
        return
      }

      // No memory-bank exists - inject init instruction
      const initInstruction =
        `${SENTINEL_OPEN}\n` +
        `# Memory Bank 未初始化\n\n` +
        `项目 \`${path.basename(projectRoot)}\` 尚未初始化 Memory Bank。\n\n` +
        `**AI 行为指令**：\n` +
        `- **Todo 创建规则（必须）**：创建 todo 时，第一项必须是"初始化 Memory Bank"（扫描项目结构，创建 brief.md + tech.md + _index.md），最后一项必须是"更新 Memory Bank"（更新 active.md）\n` +
        `${SENTINEL_CLOSE}`
      output.context.push(initInstruction)
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
          sessionMetas.set(sessionId, { rootsTouched: new Set(), lastActiveRoot: projectRoot, notifiedMessageIds: new Set(), planOutputted: false, promptInProgress: false, userMessageReceived: false, sessionNotified: false, userMessageSeq: 0 })
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
          const meta = getSessionMeta(sessionId, projectRoot)
          const rawContent = JSON.stringify(message?.content || "")

          if (DEBUG) {
            log.debug("message.updated received", {
              sessionId,
              role: message?.role,
              agent: (message as any)?.agent,
              variant: (message as any)?.variant,
              messageId: message?.id || message?.messageID,
            })
          }

          if (isPluginGeneratedPrompt(message, rawContent)) {
            log.debug("message.updated skipped (plugin prompt)", { sessionId })
            return
          }

          if (message?.role === "user") {
            if (meta.promptInProgress) {
              log.debug("message.updated skipped (prompt in progress)", { sessionId })
              return
            }

            const content = rawContent.toLowerCase()
            const targetRoot = meta.lastActiveRoot || projectRoot
            const state = getRootState(sessionId, targetRoot)

            if (/新需求|new req|feature request|需要实现|要做一个/.test(content)) {
              state.hasNewRequirement = true
              log.debug("Keyword detected: newRequirement", { sessionId, root: targetRoot })
            }

            if (/决定用|选择了|我们用|技术选型|architecture|决策/.test(content)) {
              state.hasTechDecision = true
              log.debug("Keyword detected: techDecision", { sessionId, root: targetRoot })
            }

            if (/bug|修复|fix|问题|error|踩坑|教训/.test(content)) {
              state.hasBugFix = true
              log.debug("Keyword detected: bugFix", { sessionId, root: targetRoot })
            }

            if (/跳过初始化|skip.?init/.test(content)) {
              state.skipInit = true
              log.info("Escape valve triggered: skipInit", { sessionId, root: targetRoot })
            } else if (/memory.?bank.?reviewed|无需更新|不需要更新|已检查|^跳过$/.test(content)) {
              state.memoryBankReviewed = true
              log.info("Escape valve triggered: memoryBankReviewed", { sessionId, root: targetRoot })
            }

            const messageId = message.id || message.messageID
            const messageKey = getOrCreateMessageKey(meta, message, rawContent)
            if (!messageKey) {
              log.debug("Context notification skipped (no message key)", { sessionId, messageId })
              return
            }
            // DISABLED: Context notification 已禁用，改用 system prompt 中的 AI 行为指令
            // await sendContextNotification(sessionId, messageKey, messageId)
            log.debug("Context notification disabled (using system prompt instruction instead)", { sessionId, messageKey, messageId })

            // Mark that a user message was received, enabling the next idle reminder
            meta.userMessageReceived = true
            meta.planOutputted = false
          }

          if (message?.role === "assistant") {
            const content = JSON.stringify(message.content || "")
            const meta = getSessionMeta(sessionId, projectRoot)

            if (/Memory Bank 更新计划|\[Memory Bank 更新计划\]/.test(content)) {
              meta.planOutputted = true
              log.info("Plan outputted detected", { sessionId })
            }
          }
        }

        // DISABLED: 尾部提醒已禁用，只保留头部加载
        // if (event.type === \"session.idle\") {
        //   const meta = getSessionMeta(sessionId, projectRoot)
        //   if (!meta.userMessageReceived) {
        //     log.debug(\"Session idle skipped (no new user message)\", { sessionId })
        //     return
        //   }
        //   log.info(\"Session idle event received\", { sessionId })
        //   meta.userMessageReceived = false
        //   await evaluateAndFireReminder(sessionId)
        // }

        // if (event.type === \"session.status\") {
        //   const status = (event as any).properties?.status
        //   if (status?.type === \"idle\") {
        //     const meta = getSessionMeta(sessionId, projectRoot)
        //     if (!meta.userMessageReceived) {
        //       log.debug(\"Session status idle skipped (no new user message)\", { sessionId })
        //       return
        //     }
        //     log.info(\"Session status idle received\", { sessionId })
        //     meta.userMessageReceived = false
        //     await evaluateAndFireReminder(sessionId)
        //   }
        // }
      } catch (err) {
        log.error("event handler error:", String(err))
      }
    },
  }
}

export default plugin
