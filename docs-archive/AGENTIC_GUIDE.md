# AGENTIC_GUIDE.md - Complete Overview

Your app is designed to grow with Claude's help. This guide shows you how.

## What is "Agentic"?

Instead of manually writing 100+ code snippets, you ask Claude to generate them. Instead of manually testing each one, Claude validates them. Instead of writing descriptions, Claude enhances them. You stay in control, but Claude handles the bulk work.

## Three Levels of Integration

### Level 1: Manual (Fastest for Now)

You ask Claude in Claude Code:
```
Generate 5 interview patterns as JavaScript snippets.
Return as JSON matching this structure: {...}
```

Claude returns JSON. You copy it into your app. Done in 10 minutes.

**Best for:** Starting out, iterating quickly, staying in control

### Level 2: Scripted (Slightly Slower, More Automated)

You run scripts that call Claude API:
```bash
node scripts/generate-patterns.js
node scripts/validate-snippets.js
node scripts/enhance-descriptions.js
```

Scripts batch-process patterns, save to JSON files, you review before committing.

**Best for:** Regular updates, batch operations, audit trails

### Level 3: Full Pipeline (Planned)

Eventually: scheduled jobs that auto-validate, auto-enhance, auto-deploy (with manual approval).

**Best for:** Later, when you trust the system completely

## Start Here: Level 1 (Manual)

### Step 1: Set Up Claude API Access

1. Get API key: https://console.anthropic.com/
2. Copy `.env.local.example` to `.env.local`
3. Paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### Step 2: Ask Claude Code to Generate Patterns

Open Claude Code and paste this:

```
Read coding-practice-app/app/page.js and understand the PATTERNS data structure.

Generate 5 JavaScript interview patterns:
1. Stack (2 snippets: basic stack, monotonic stack)
2. Queue (2 snippets: basic queue, deque)
3. Hash Map (2 snippets: frequency counting, anagram grouping)
4. Heap (2 snippets: min heap, max heap)
5. Graph (2 snippets: BFS, DFS)

For each snippet, return JSON:
{
  id: "kebab-case-id",
  title: "Descriptive Title",
  description: "One sentence on when to use this",
  code: "// Complete, runnable JavaScript function",
  testCode: "// Code that calls the function and logs output",
  expectedOutput: "What console.log should print"
}

Keep code under 20 lines, test data small (5-10 elements max).
Make sure testCode actually works with the code.
```

Claude returns JSON. Copy it into `app/page.js` PATTERNS array. Test in browser (`npm run dev`). Done.

### Step 3: Expand Gradually

Repeat step 2 for more patterns. Build up your library over time.

---

## Later: Level 2 (Scripts)

When you have enough patterns and want to automate quality checks.

### Install Claude SDK

```bash
npm install @anthropic-ai/sdk
```

### Run Validation

```bash
node scripts/validate-snippets.js
```

This reads `data/patterns.json` and checks all snippets via Claude API. Outputs `validation-results.json` with any issues.

### Run Enhancement

```bash
node scripts/enhance-descriptions.js
```

This improves all descriptions, adds gotchas, complexity analysis. Outputs `patterns-enhanced.json`.

### Generate Batch Patterns

```bash
node scripts/generate-patterns.js
```

Generates many patterns at once. Outputs `data/patterns.json`.

---

## File Roles

| File | Purpose | You Control | Claude Controls |
| --- | --- | --- | --- |
| app/page.js | Live app code | Yes | No |
| data/patterns.json | Canonical pattern data | By reviewing Claude's output | Full output |
| data/patterns-enhanced.json | Improved patterns | Review before merging | Full output |
| data/validation-results.json | Quality report | Review for issues | Full output |
| .env.local | API key | Yes (secret) | No |
| scripts/*.js | Agentic scripts | Minor edits only | No |

Flow:
```
Claude generates -> data/patterns-enhanced.json
You review -> Decide what to merge
You copy -> app/page.js
You test -> npm run dev
You commit -> git push
```

---

## Typical Weekly Workflow

### Monday: Generate

Ask Claude Code:
```
Generate 5 new NeetCode patterns. Return as JSON array.
```

Save output to `data/patterns-batch-monday.json`.

### Wednesday: Validate

```bash
cp data/patterns-batch-monday.json data/patterns.json
node scripts/validate-snippets.js
```

Review `validation-results.json`. Fix any broken snippets with Claude.

### Friday: Enhance & Ship

```bash
node scripts/enhance-descriptions.js
```

Review `patterns-enhanced.json`. Copy improvements into `app/page.js`.

```bash
npm run dev
# Spot-check 5 random patterns in browser
npm run build
# Deploy to Vercel
```

---

## What Claude Can Do

### Generate Patterns

- New interview patterns from scratch
- Multiple snippets per pattern
- Code, tests, expected output
- JSON ready to paste

### Validate Snippets

- Syntax checking
- Test case verification
- Expected output validation
- Suggest fixes for broken snippets

### Enhance Content

- Improve descriptions
- Add gotchas (common mistakes)
- Complexity analysis (time, space)
- Real-world use cases

### Debug Issues

- Why is this snippet failing?
- Is this algorithm correct?
- How would you improve this?

### Batch Operations

- Export to markdown
- Generate study guides
- Create metadata
- Format for external tools

---

## What Claude Can't Do (For You)

- Ship without your approval
- Make API calls without your key
- Delete or modify app.js directly
- Deploy without your command

You're always in the loop. Claude suggests, you decide.

---

## Specific Prompts to Copy

See `CLAUDE_CODE_PROMPTS.md` for ready-to-use prompts covering:
- Generate 10 patterns at once
- Validate all snippets
- Fix broken snippets
- Export to markdown
- Improve descriptions
- Add complexity metadata
- And 10+ more

Just copy, paste into Claude Code, run.

---

## Troubleshooting

### "API key not found"

```bash
# Check .env.local exists and has key
cat .env.local
# Should show: ANTHROPIC_API_KEY=sk-ant-...
```

### "Script runs but output is empty"

Check:
1. API key is valid (test with a simple prompt)
2. data/patterns.json exists
3. Try manually: ask Claude directly first

### "Generated code is broken"

Ask Claude:
```
This snippet is broken. Fix it:
[paste code + error]
```

Claude will fix it. This is normal.

### "Patterns.json and app/page.js are out of sync"

Use data/ as source of truth:
```bash
# Copy from data to app
# Don't edit both at once
cp data/patterns-final.json data/patterns-backup.json
# Update app/page.js from data/patterns.json
```

---

## Cost Considerations

- Generating patterns: ~0.10-0.20 per pattern (2 snippets each)
- Validating snippets: ~0.05 per 10 snippets
- Enhancing descriptions: ~0.05 per 10 snippets

Generating 50 patterns (low cost): ~$10-15 total

Validate + enhance weekly: ~$1-2 per week

Claude Sonnet 4 is cheap for this workload. Run freely.

---

## Next Steps

1. **This week:** Try Level 1 (manual generation)
   - Ask Claude Code to generate 5 patterns
   - Copy into app, test, commit

2. **Next week:** Try Level 2 (scripted validation)
   - Run validation script
   - Fix any broken snippets
   - Enhance descriptions

3. **Ongoing:** Use `CLAUDE_CODE_PROMPTS.md` as your copilot
   - Add patterns weekly
   - Validate before deploying
   - Stay on top of quality

---

## Questions?

Refer to:
- `claude.md` - API integration details
- `AGENTIC_WORKFLOW.md` - Detailed workflow
- `CLAUDE_CODE_PROMPTS.md` - Ready-to-use prompts
- `QUICK_REFERENCE.md` - General app docs

Or ask Claude: "How do I [specific task]?" It knows its own system.

