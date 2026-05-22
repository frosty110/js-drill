# Interview Syntax Drill - Setup

## Quick Start (Autonomous Build)

### 1. Create project directory

```bash
mkdir coding-practice-app
cd coding-practice-app
```

### 2. Copy documentation files

Place these reference docs in your directory:
- SETUP.md (this file)
- QUICK_REFERENCE.md
- ARCHITECTURE.md
- claude.md
- AGENTIC_GUIDE.md
- CLAUDE_CODE_PROMPTS.md
- AGENTIC_WORKFLOW.md
- AUTONOMOUS_BUILD_PROMPT.txt
- RUN_AUTONOMOUS_BUILD.md

### 3. Run autonomous build

Copy the entire content of `AUTONOMOUS_BUILD_PROMPT.txt` and paste into Claude Code:

```bash
claude < AUTONOMOUS_BUILD_PROMPT.txt
```

Or manually paste the prompt. Claude will execute all 5 phases and build the complete project structure.

### 4. Install dependencies

```bash
npm install
```

### 5. Run dev server

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## File Structure (After Build)

```
coding-practice-app/
├── app/
│   ├── layout.js
│   ├── page.js
│   └── globals.css
├── data/
│   └── patterns.json
├── scripts/
│   ├── generate-patterns.js
│   ├── validate-snippets.js
│   └── enhance-descriptions.js
├── public/
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
├── package.json
└── [all doc files above]
```

---

## What Autonomous Build Does

1. Creates directory structure (app/, data/, scripts/, public/)
2. Creates all configuration files
3. Creates React app component with 5 patterns
4. Creates Next.js layout and styling
5. Creates data directory and patterns.json
6. Validates all files exist
7. Prints setup summary

No manual file copying needed. Claude does it all.

---

## Notes

- No tests (as requested)
- Minimal dependencies
- All snippets hardcoded in `app/page.js` for easy iteration
- Edit snippets directly in the code, no database
- Deploy to Vercel with one click when ready
- Docs stay in root directory for easy reference

