// Runs Pyswahili code in the browser. Nothing is sent to a server.
//
// The Pyodide worker is created the first time something is run, never at
// page load. A run that exceeds the timeout is stopped by terminating the
// worker; a fresh one is created for the next run.
//
// ingiza() / input(): a worker cannot block for an answer without
// cross-origin isolation headers, which GitHub Pages cannot send. So when the
// program asks for input it stops, the page asks the learner, and the program
// is run again from the top with the answers given so far. The random seed is
// fixed for the whole run so a replay follows the same path.
import { toPython } from '../lib/translate.js'
import { describeError } from '../lib/errors.js'

export const TIMEOUT_MS = 10_000
export const OUTPUT_LIMIT = 20_000
// Measured transfer size of the pinned Pyodide core (wasm, stdlib, loader).
export const PYODIDE_DOWNLOAD_MB = 5.6

let worker = null
let workerState = 'none' // none | loading | ready
let loadWaiters = []
let current = null // the run in progress
let queue = Promise.resolve()
let nextId = 1
const statusListeners = new Set()

function setState(state) {
  workerState = state
  statusListeners.forEach((fn) => fn(state))
}

// Subscribe to 'none' | 'loading' | 'ready' changes. Returns an unsubscribe function.
export function onRunnerState(fn) {
  statusListeners.add(fn)
  fn(workerState)
  return () => statusListeners.delete(fn)
}

function killWorker() {
  if (worker) worker.terminate()
  worker = null
  loadWaiters.forEach((w) => w.reject(new Error('worker stopped')))
  loadWaiters = []
  setState('none')
}

function ensureWorker() {
  if (worker && workerState === 'ready') return Promise.resolve()
  if (!worker) {
    setState('loading')
    worker = new Worker(new URL('./pyWorker.js', import.meta.url))
    worker.onmessage = (event) => {
      const msg = event.data
      if (msg.type === 'ready') {
        setState('ready')
        loadWaiters.forEach((w) => w.resolve())
        loadWaiters = []
      } else if (msg.type === 'loaderror') {
        const waiters = loadWaiters
        loadWaiters = []
        killWorker()
        waiters.forEach((w) => w.reject(new Error(msg.message)))
      } else if (current && msg.id === current.id) {
        current.onMessage(msg)
      }
    }
    worker.onerror = () => {
      const waiters = loadWaiters
      loadWaiters = []
      killWorker()
      waiters.forEach((w) => w.reject(new Error('worker failed')))
      if (current) current.onMessage({ type: 'crash' })
    }
  }
  return new Promise((resolve, reject) => loadWaiters.push({ resolve, reject }))
}

// One pass of the program with a fixed list of answers for input().
function runOnce(python, inputs, seed, { onOutput, timeoutMs, signal }) {
  return new Promise((resolve) => {
    const id = nextId++
    let timer = null
    const finish = (value) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      current = null
      resolve(value)
    }
    const onAbort = () => {
      killWorker()
      finish({ error: { type: 'Stopped' } })
    }
    if (signal?.aborted) {
      resolve({ error: { type: 'Stopped' } })
      return
    }
    signal?.addEventListener('abort', onAbort)
    current = {
      id,
      onMessage(msg) {
        if (msg.type === 'started') {
          // The clock starts when Python starts, not while Pyodide downloads.
          timer = setTimeout(() => {
            killWorker()
            finish({ error: { type: 'Timeout', seconds: Math.round(timeoutMs / 1000) } })
          }, timeoutMs)
        } else if (msg.type === 'out') {
          onOutput(msg.text)
        } else if (msg.type === 'done') {
          finish(msg.result)
        } else if (msg.type === 'crash') {
          finish({ error: { type: 'LoadError' } })
        }
      },
    }
    ensureWorker().then(
      () => worker.postMessage({ type: 'run', id, code: python, inputs, seed, outputLimit: OUTPUT_LIMIT }),
      () => {
        if (current && current.id === id) finish({ error: { type: signal?.aborted ? 'Stopped' : 'LoadError' } })
      },
    )
  })
}

async function execute(code, options) {
  const { onOutput, requestInput, timeoutMs = TIMEOUT_MS, signal } = options
  const python = toPython(code)
  const seed = Math.floor(Math.random() * 2 ** 31)
  const inputs = []
  for (;;) {
    let output = ''
    onOutput?.('', true) // a replay starts the transcript again
    // eslint-disable-next-line no-await-in-loop
    const result = await runOnce(python, inputs, seed, {
      timeoutMs,
      signal,
      onOutput: (text) => {
        output += text
        onOutput?.(output, false)
      },
    })
    let raw = result.error
    if (!raw && result.truncated) raw = { type: 'OutputLimit', limit: OUTPUT_LIMIT }
    if (!raw && result.needInput != null) {
      if (!requestInput) {
        raw = { type: 'EOFError', message: 'input() was called but nothing can answer it here', line: null }
      } else {
        // eslint-disable-next-line no-await-in-loop
        const answer = await requestInput(result.needInput, output)
        if (answer == null) raw = { type: 'InputCancelled' }
        else {
          inputs.push(String(answer))
          continue
        }
      }
    }
    if (!raw) return { output, error: null, errorInfo: null }
    const errorInfo = describeError(raw)
    return { output, error: errorInfo.text, errorInfo }
  }
}

// Run Pyswahili (or plain Python) source.
// Resolves to { output, error, errorInfo }: `output` is everything printed,
// `error` is null or a two-line message (Swahili, then the English original),
// `errorInfo` is null or { type, line, sw, en }. It never rejects.
//
// options: onOutput(textSoFar), requestInput(prompt) -> Promise<string|null>,
//          timeoutMs, signal (AbortSignal to stop the run).
export function runSwahili(code, options = {}) {
  const job = queue.then(() => execute(String(code ?? ''), options))
  queue = job.catch(() => {})
  return job
}
