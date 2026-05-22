# How to Run Autonomous Build

## Step 1: You're Ready

You already have all the files in `coding-practice-app/` directory. Do NOT delete anything.

Keep all the .md doc files. They're your reference library.

## Step 2: Run the Autonomous Build

Open terminal in `coding-practice-app/`:

```bash
cd coding-practice-app
```

Copy the ENTIRE content from `AUTONOMOUS_BUILD_PROMPT.txt` and paste into Claude Code CLI:

```bash
claude
# Paste the entire prompt from AUTONOMOUS_BUILD_PROMPT.txt
```

Or use stdin:

```bash
cat AUTONOMOUS_BUILD_PROMPT.txt | claude
```

Claude will execute 5 phases:
1. Create directory structure (app/, data/, scripts/, public/)
2. Create config files (package.json, tailwind, postcss, next)
3. Create app files (page.js, layout.js, globals.css)
4. Create data directory and patterns.json
5. Validate everything and print summary

Wait for completion message.

## Step 3: Install Dependencies

```bash
npm install
```

This installs React, Next.js, Tailwind, etc.

## Step 4: Run Dev Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

You should see the Interview Syntax Drill app with 5 patterns and a dark UI.

## Step 5: Test It Works

1. Click a pattern name in sidebar
2. Click "Run" button
3. See output on right side
4. Confirm it matches expected output
5. Click "Next Snippet" to try another variant

Done. App is working.

---

## What If Something Goes Wrong?

### Claude asks "what would you like to do?"

The prompt wasn't pasted completely or clearly. Try again:
```bash
cat AUTONOMOUS_BUILD_PROMPT.txt | claude
```

### "npm: command not found"

Install Node.js from https://nodejs.org/

### "Port 3000 already in use"

```bash
npm run dev -- -p 3001
```

### Files don't exist after build

Check that the autonomous build completed fully. Look for the summary output.

If not, manually create app/page.js from the copy in outputs/.

---

## That's It

The autonomous build is one command. Everything else is `npm install` and `npm run dev`.

No manual file copying.
No configuration.
No guessing.

Just one prompt, then it's done.
