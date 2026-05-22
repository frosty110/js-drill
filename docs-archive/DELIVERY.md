# DELIVERY PACKAGE - Interview Syntax Drill

This package contains everything needed to build and run a coding interview practice app.

## Files in This Package

### Essential (Copy to `coding-practice-app/`)

**START HERE:**
- **README.md** - Master guide, read this first
- **AUTONOMOUS_BUILD_PROMPT.txt** - Copy this entire content into Claude Code

**Reference Documentation:**
- **SETUP.md** - Installation details
- **QUICK_REFERENCE.md** - How to use the app
- **RUN_AUTONOMOUS_BUILD.md** - Step-by-step build instructions

**For Later (After App is Built):**
- **ARCHITECTURE.md** - How the code works
- **claude.md** - Claude API integration details
- **AGENTIC_GUIDE.md** - How to generate 100+ patterns with AI
- **AGENTIC_WORKFLOW.md** - Detailed workflow for maintaining patterns
- **CLAUDE_CODE_PROMPTS.md** - Ready-to-use prompts for extending

**Configuration:**
- **.env.local.example** - Template for Claude API key (rename to .env.local and fill in)

**Agentic Scripts (For Later):**
- **generate-patterns.js** - Auto-generate patterns via Claude API
- **validate-snippets.js** - Auto-validate patterns
- **enhance-descriptions.js** - Auto-improve descriptions

---

## Setup Instructions

### Step 1: Copy All Files to Your Project Directory

```bash
mkdir coding-practice-app
cd coding-practice-app

# Copy all files from this delivery package to coding-practice-app/
cp -r /path/to/delivery/* .
```

Your directory should now contain:
```
coding-practice-app/
├── README.md
├── SETUP.md
├── QUICK_REFERENCE.md
├── ARCHITECTURE.md
├── RUN_AUTONOMOUS_BUILD.md
├── AUTONOMOUS_BUILD_PROMPT.txt
├── AGENTIC_GUIDE.md
├── AGENTIC_WORKFLOW.md
├── CLAUDE_CODE_PROMPTS.md
├── claude.md
├── .env.local.example
├── generate-patterns.js
├── validate-snippets.js
└── enhance-descriptions.js
```

(No `app/`, `data/`, or config files yet - the autonomous build creates those)

### Step 2: Read README.md

```bash
cat README.md
```

This explains what you're building and how to use it.

### Step 3: Run Autonomous Build

Copy the ENTIRE content of `AUTONOMOUS_BUILD_PROMPT.txt`:

```bash
cat AUTONOMOUS_BUILD_PROMPT.txt
# Select all (Cmd+A or Ctrl+A)
# Copy
```

Open Claude Code and paste it:

```bash
claude
# Paste the entire prompt
# Press Enter
# Wait for completion
```

The build will create:
- `app/` directory with all React files
- `data/` directory with patterns.json
- `scripts/` directory with agentic scripts
- `public/` directory for static assets
- All configuration files (package.json, tailwind.config.js, etc.)

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Run the App

```bash
npm run dev
```

Visit `http://localhost:3000`

You now have a working interview practice app.

---

## File Organization After Build

After the autonomous build completes, your directory will be:

```
coding-practice-app/
├── app/
│   ├── page.js           (main React component - 5 patterns)
│   ├── layout.js         (Next.js root layout)
│   └── globals.css       (Tailwind + custom styles)
├── data/
│   └── patterns.json     (pattern data)
├── scripts/
│   ├── generate-patterns.js
│   ├── validate-snippets.js
│   └── enhance-descriptions.js
├── public/               (static assets)
├── package.json
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
├── .env.local.example
├── README.md
├── SETUP.md
├── QUICK_REFERENCE.md
├── ARCHITECTURE.md
├── RUN_AUTONOMOUS_BUILD.md
├── AUTONOMOUS_BUILD_PROMPT.txt
├── AGENTIC_GUIDE.md
├── AGENTIC_WORKFLOW.md
├── CLAUDE_CODE_PROMPTS.md
├── claude.md
├── generate-patterns.js
├── validate-snippets.js
└── enhance-descriptions.js
```

All documentation stays in the root for easy reference. App code is in `app/`, data in `data/`, scripts in `scripts/`.

---

## Using the App

1. Click a pattern in the sidebar
2. See code in the editor
3. Click "Run" to execute
4. Compare output to expected result
5. Click "Next Snippet" to see variant
6. Repeat

---

## Expanding with AI (After Setup)

Once the app is working, you can use Claude to generate 100+ patterns:

```bash
# Read AGENTIC_GUIDE.md for instructions
cat AGENTIC_GUIDE.md

# Or use ready-made prompts:
cat CLAUDE_CODE_PROMPTS.md
```

Copy prompts and paste into Claude Code to generate patterns, validate them, improve descriptions.

---

## Troubleshooting

See `RUN_AUTONOMOUS_BUILD.md` for common issues.

---

## Questions?

- **How do I use the app?** → Read QUICK_REFERENCE.md
- **How does the code work?** → Read ARCHITECTURE.md
- **How do I add patterns?** → Read QUICK_REFERENCE.md or AGENTIC_GUIDE.md
- **How do I deploy?** → Read QUICK_REFERENCE.md (deploy section)

---

## Summary

1. Copy all files to `coding-practice-app/`
2. Read README.md
3. Copy AUTONOMOUS_BUILD_PROMPT.txt into Claude Code
4. `npm install` + `npm run dev`
5. App is live at http://localhost:3000

Everything else is optional (extending with AI, deployment, etc.).

Good luck with interview prep!
