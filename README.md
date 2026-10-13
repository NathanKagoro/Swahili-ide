# Pyswahili IDE

A browser coding environment where learners write Python using Swahili keywords: `andika("Habari, Dunia!")` instead of `print("Hello, World!")`. It has a playground, 20 short lessons with narration, four practice tasks and a dictionary of the 47 Swahili keywords.

Hosted at **https://nathankagoro.github.io/Swahili-ide/** (GitHub Pages, static, no server).

The interface is laid out like a kanga, the printed cloth of the Swahili coast: a patterned border (pindo), a centre panel (mji) that holds the editor and console, and a proverb line (jina) that changes with each lesson.

## What is real and what is not

- **Running code is real.** Your code is translated from Swahili keywords to Python in the page and run by [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly, version 0.27.7 from jsDelivr) inside a Web Worker. Nothing is sent to a server.
- **Lessons, tasks and dictionary are real** and every example in them is run by the test suite.
- **Lesson narration is a computer voice.** The 40 recordings were generated with Piper text-to-speech, not read by a person, and the page says so. They were made from an earlier wording of the lessons, so the closing challenge in lessons 17 and 18 differs slightly from the text on the page.
- **Proverbs** on the jina line are established Swahili methali with plain English glosses.
- **Kanga patterns** are generated in SVG by `frontend/src/lib/kanga.js`. They are in the style of kanga borders, not copies of any printed design.
- **There are no accounts.** Lesson progress is kept in your browser's `localStorage` and nowhere else.
- **The assistant, voice tutor and server speech-to-text are not on the public site.** They need a backend holding API keys. See [Optional backend](#optional-backend).

## How code runs

1. `frontend/src/lib/keywords.js` is the one keyword table. The translator, the editor highlighting and the dictionary page all read it. The table comes from [pyswahili](https://github.com/Kalebu/pyswahili) by Jordan Kalebu (MIT; licence in `frontend/src/lib/PYSWAHILI-LICENSE.txt`).
2. `frontend/src/lib/translate.js` swaps keyword tokens and leaves strings, comments and line breaks alone, so error line numbers match what the learner typed. It is a JavaScript port of pyswahili's `convert_to_english`.
3. `frontend/src/runner/runner.js` starts the Pyodide worker the first time Run is pressed (about 5.6 MB, cached by the browser afterwards), captures output, stops after 10 seconds by terminating the worker, and cuts output at 20,000 characters.
4. Errors are shown in Swahili with the line number, with the English original underneath.

`ingiza()` (input): a worker cannot wait for an answer without cross-origin isolation headers, which GitHub Pages cannot send. When a program asks for input it stops, the page asks the learner, and the program runs again from the top with the answers so far. The random seed is fixed for the run so the replay takes the same path. A bare `ila:` is treated as `except Exception:` so it cannot swallow that pause.

Because the code runs in the learner's own browser, the old server restrictions are gone: methods such as `orodha.append(...)`, classes and standard-library imports all work.

## Run, build, test

Needs Node 22.

```bash
cd frontend
npm install
npm run dev            # http://127.0.0.1:4370/Swahili-ide/
npm run build          # writes frontend/dist, with 404.html
npm test               # 41 unit tests: translator, progress storage, error messages, patterns
npm run test:lessons   # 172 real programs in headless Chrome against the build
npm run shots          # screenshots at 1440, 390 and 360 px into frontend/shots
```

`test:lessons` and `shots` need Chrome; set `CHROME_PATH` if it is not in a standard place. `test:lessons` runs the language features (print, variables, conditions, loops, functions, lists, dicts, try/except, a syntax error, a timeout, the output cap, `ingiza()`), then every lesson example and model answer in both Pyswahili and Python, every practice task, every dictionary example and every playground sample.

The build assumes it is served from `/Swahili-ide/`. For a different path set `VITE_BASE`, for example `VITE_BASE=/ npm run build`.

Regenerating assets:

```bash
node scripts/gen-assets.mjs      # favicon, touch icon, preview image
# lesson narration, from the WAV files in backend/audio (needs ffmpeg):
for f in ../backend/audio/lesson-*.wav; do
  n=$(basename "$f" .wav | sed -E 's/^lesson-([0-9]+)_.*_(sw|en)$/somo-\1-\2/')
  ffmpeg -y -i "$f" -ac 1 -ar 22050 -c:a libmp3lame -b:a 24k "public/audio/$n.mp3"
done
```

## Hosting

`.github/workflows/pages.yml` builds `frontend/` and deploys `frontend/dist` on every push to `main`. It needs one setting in the repository: **Settings → Pages → Source: GitHub Actions**.

`.github/workflows/ci.yml` runs on every push and pull request: unit tests, the build, the headless program run, screenshots (uploaded as an artifact) and the backend sandbox tests.

## Optional backend

The FastAPI server in `backend/` is kept for three extras. None of them is needed to write and run code.

| Feature | What it does | Needs |
| --- | --- | --- |
| Msaidizi Amani | Chat that explains code and writes Pyswahili examples | `OPENROUTER_API_KEY`, or Ollama |
| Voice tutor | Live spoken conversation, answers in English | `DEEPGRAM_API_KEY`, `DEEPGRAM_AGENT_ENABLED=true` |
| Server speech to text | Records audio and transcribes it into the chat box | Whisper (local) or Deepgram |

The frontend shows these in one collapsed panel on the playground. They switch on only when the site was built with `VITE_API_URL` **and** the backend answers `GET /health`. Otherwise the panel just explains what they are.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # large: includes PyTorch and Whisper
copy .env.example .env            # then fill in your own keys
uvicorn app.main:app --host 127.0.0.1 --port 8000

cd ../frontend
echo VITE_API_URL=http://127.0.0.1:8000/api > .env.local
npm run dev
```

Set `FRONTEND_ORIGIN` in `backend/.env` to the address the frontend is served from, or the browser will block the requests. More detail is in `docs/`.

Backend tests: `pip install -r requirements-dev.txt` then `python -m pytest tests/test_sandbox.py` (14 tests).

**Before putting the backend on the internet:** `backend/app/utils/sandbox.py` runs submitted code in a child process with a time limit and an output limit, and since this revision with a clean environment so API keys are not visible to it. It has **no memory limit**: `'a' * (2 * 10**9)` succeeds. Run it under a container memory cap or `RLIMIT_AS`, and rate-limit `/api/run-swahili`. The public site does not use this endpoint.

Not in the repository: the SQLite database (`backend/data/`), the Piper binaries (`backend/piper/`) and the hashed text-to-speech cache (`backend/audio/<hash>.wav`). They are created or downloaded at runtime and are ignored by git.

## Layout

```
frontend/
  src/lib/         keywords, translator, error messages, progress storage, kanga patterns, editor set-up
  src/runner/      Pyodide worker and the runSwahili() function
  src/views/       playground, lessons, practice, dictionary
  src/data/        lessons, practice tasks, dictionary examples, samples
  public/audio/    40 lesson narrations (MP3, about 130 KB each)
  scripts/         headless program runner, screenshots, asset generator
  tests/           unit tests
backend/           optional FastAPI server
docs/              backend API and architecture notes
```

## Credits

Keyword table and translation approach: [pyswahili](https://github.com/Kalebu/pyswahili) by Jordan Kalebu, MIT licence. Python runtime: Pyodide. Editor: CodeMirror 6. Fonts: Alfa Slab One, Atkinson Hyperlegible, JetBrains Mono (SIL Open Font Licence), self-hosted.
