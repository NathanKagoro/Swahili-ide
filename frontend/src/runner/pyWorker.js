/* eslint-disable no-restricted-globals */
// Web Worker that runs Python with Pyodide. It is a classic worker with no
// imports so that importScripts can pull Pyodide from the CDN.
//
// Messages in:   { type: 'run', id, code, inputs: string[], seed, outputLimit }
// Messages out:  { type: 'ready' } | { type: 'loaderror', message }
//                { type: 'started', id }
//                { type: 'out', id, text }
//                { type: 'done', id, result: { error, needInput, truncated } }

// Pinned. Changing the version changes what learners run, so do it on purpose.
const PYODIDE_VERSION = '0.27.7'
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

const HARNESS = `
import ast, builtins, json, random, sys, traceback

class _NeedInput(BaseException):
    pass

class _OutputLimit(BaseException):
    pass

class _Out:
    def __init__(self, emit, cap):
        self.emit, self.cap, self.n = emit, cap, 0
    def write(self, text):
        text = str(text)
        room = self.cap - self.n
        if room <= 0:
            raise _OutputLimit()
        self.emit(text[:room])
        self.n += len(text)
        if self.n > self.cap:
            raise _OutputLimit()
        return len(text)
    def flush(self):
        pass
    def isatty(self):
        return False

class _BareExcept(ast.NodeTransformer):
    # A bare "except:" (ila:) would also swallow the runner's own control
    # signals, so it is narrowed to "except Exception:". Line numbers are kept.
    def visit_ExceptHandler(self, node):
        self.generic_visit(node)
        if node.type is None:
            node.type = ast.copy_location(ast.Name(id='Exception', ctx=ast.Load()), node)
        return node

def _pyswahili_run(src, inputs_json, seed, emit, cap):
    out = _Out(emit, cap)
    queue = json.loads(inputs_json)
    def _input(prompt=''):
        prompt = str(prompt)
        if not queue:
            out.write(prompt)
            raise _NeedInput(prompt)
        answer = queue.pop(0)
        out.write(prompt + answer + '\\n')
        return answer
    scope = {'__name__': '__main__', '__builtins__': builtins, 'input': _input}
    result = {'error': None, 'needInput': None, 'truncated': False}
    random.seed(seed)
    saved = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        tree = ast.parse(src, '<msimbo>', 'exec')
        tree = ast.fix_missing_locations(_BareExcept().visit(tree))
        exec(compile(tree, '<msimbo>', 'exec'), scope)
    except _NeedInput as signal:
        result['needInput'] = str(signal)
    except _OutputLimit:
        result['truncated'] = True
    except SystemExit:
        pass
    except SyntaxError as exc:
        result['error'] = {'type': type(exc).__name__, 'message': exc.msg or '', 'line': exc.lineno}
    except BaseException as exc:
        line = None
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == '<msimbo>':
                line = frame.lineno
        result['error'] = {'type': type(exc).__name__, 'message': str(exc), 'line': line}
    finally:
        sys.stdout, sys.stderr = saved
    return json.dumps(result)
`

let runPython = null

const ready = (async () => {
  try {
    importScripts(`${INDEX_URL}pyodide.js`)
    const pyodide = await self.loadPyodide({ indexURL: INDEX_URL })
    pyodide.runPython(HARNESS)
    runPython = pyodide.globals.get('_pyswahili_run')
    self.postMessage({ type: 'ready' })
    return true
  } catch (err) {
    self.postMessage({ type: 'loaderror', message: String(err && err.message ? err.message : err) })
    return false
  }
})()

self.onmessage = async (event) => {
  const msg = event.data
  if (!msg || msg.type !== 'run') return
  if (!(await ready)) return
  const { id, code, inputs, seed, outputLimit } = msg
  self.postMessage({ type: 'started', id })

  // Output is sent in batches: at most one message every 50 ms, even from a
  // tight loop that never yields.
  let pending = ''
  let lastSent = 0
  const send = () => {
    if (pending) self.postMessage({ type: 'out', id, text: pending })
    pending = ''
    lastSent = Date.now()
  }
  const emit = (text) => {
    pending += text
    if (Date.now() - lastSent > 50) send()
  }

  let result
  try {
    result = JSON.parse(runPython(code, JSON.stringify(inputs || []), seed, emit, outputLimit))
  } catch (err) {
    // Only reached if Pyodide itself fails (for example a fatal stack overflow).
    result = { error: { type: 'RecursionError', message: String(err && err.message ? err.message : err).split('\n')[0], line: null }, needInput: null, truncated: false }
  }
  send()
  self.postMessage({ type: 'done', id, result })
}
