# AGENTIC_WORKFLOW.md - Claude Code Integration

## Overview

This app is designed to be enhanced and maintained by Claude Code (agentic workflows). You can ask Claude to generate patterns, validate snippets, and improve descriptions automatically.

## Quick Commands for Claude Code

### 1. Generate All Missing NeetCode Patterns

Ask Claude Code:

```
Read interview-syntax-drill/app/page.js and extract current PATTERNS.
Compare to the full NeetCode problem list.
Generate new patterns for the top 10 missing ones using interview-syntax-drill/scripts/generate-patterns.js.
Validate the output and merge into data/patterns.json.
```

### 2. Validate All Snippets

Ask Claude Code:

```
Run scripts/validate-snippets.js to check all snippets in data/patterns.json.
Flag any with syntax errors or broken tests.
Generate fixes for failed snippets.
Output validation-results.json.
```

### 3. Enhance Descriptions

Ask Claude Code:

```
Run scripts/enhance-descriptions.js to improve all snippet descriptions.
Add gotchas, complexity analysis, and real-world use cases.
Output patterns-enhanced.json.
Compare with original and show me the diff.
```

### 4. Add Specific Pattern

Ask Claude Code:

```
Generate 2 JavaScript snippets for the [PATTERN_NAME] interview pattern.
Make them follow the structure in app/page.js.
Validate them by running the test code.
Output as JSON ready to paste into PATTERNS array.
```

## Workflow Examples

### Daily Maintenance (5 min)

```bash
# Pull latest NeetCode problems
ask_claude_code "Check NeetCode for new/changed problems since last week"

# Validate all snippets still work
node scripts/validate-snippets.js

# Review validation-results.json
cat data/validation-results.json
```

### Weekly Expansion (30 min)

```bash
# Generate 5 new patterns
ask_claude_code "Generate 5 random NeetCode patterns using generate-patterns.js"

# Enhance all descriptions
node scripts/enhance-descriptions.js

# Review, test in browser, commit
npm run dev
```

### Before Deployment

```bash
# Full validation pipeline
node scripts/validate-snippets.js
node scripts/enhance-descriptions.js

# Manual spot-check in browser
npm run dev
# Test 3 random patterns

# Commit and deploy
git add data/
git commit -m "Update patterns and validations"
npm run build
```

## File Structure for Agentic Tasks

```
interview-syntax-drill/
├── app/
│   └── page.js              (main app, PATTERNS array)
├── scripts/
│   ├── generate-patterns.js (Claude API: generate new patterns)
│   ├── validate-snippets.js (Claude API: validate all snippets)
│   └── enhance-descriptions.js (Claude API: improve descriptions)
├── data/
│   ├── patterns.json        (generated patterns)
│   ├── patterns-enhanced.json (enhanced version)
│   └── validation-results.json (validation report)
├── claude.md                (this integration guide)
├── .env.local               (Claude API key)
└── AGENTIC_WORKFLOW.md      (you are here)
```

## How It Works

### Generate Patterns

1. Script calls Claude API with pattern name
2. Claude returns JSON: { title, description, code, testCode, expectedOutput }
3. Script aggregates into patterns.json
4. You review and copy into app/page.js

### Validate Snippets

1. Script reads patterns.json
2. For each snippet, asks Claude: "Is this code correct?"
3. Claude analyzes syntax, test, expected output
4. Returns: { isValid, issues, suggestions, severity }
5. Script writes validation-results.json
6. You fix flagged snippets

### Enhance Descriptions

1. Script reads patterns.json
2. For each snippet, asks Claude: "Improve this description"
3. Claude adds: gotchas, complexity, real-world use
4. Script writes patterns-enhanced.json
5. You decide which enhancements to merge

## Environment Setup

1. Copy `.env.local.example` to `.env.local`
2. Add your ANTHROPIC_API_KEY from https://console.anthropic.com/
3. Install Node.js dependency:

```bash
npm install @anthropic-ai/sdk
```

4. Test:

```bash
node scripts/generate-patterns.js
```

## Best Practices

### Do

- Validate generated snippets in browser before shipping
- Keep patterns.json as source of truth
- Review Claude's suggestions; don't blindly accept
- Test in browser frequently (npm run dev)
- Commit both code and generated data

### Don't

- Auto-deploy without manual testing
- Trust Claude output without validation
- Let validation results accumulate unreviewed
- Change patterns only in app/page.js (use data/ as source)

## Troubleshooting

### Script fails with API error

- Check .env.local has valid ANTHROPIC_API_KEY
- Check your API quota hasn't been exceeded
- Check rate limiting (add delays between requests)

### Generated code is broken

- Claude sometimes hallucinates syntax
- Always validate before merging
- Ask Claude to fix: "Fix this syntax error: ..."

### Patterns.json gets out of sync with app/page.js

- data/ is the authoritative source
- Always generate/enhance to data/ first
- Copy final version into app/page.js
- Don't edit both places simultaneously

## Future Enhancements

1. **Test Case Expansion** - Claude generates 5+ test cases per snippet
2. **Difficulty Levels** - Tag patterns by interview difficulty
3. **Language Support** - Generate Python/Go versions
4. **Explanation Modes** - Generate detailed walkthrough for each snippet
5. **Auto-Deploy** - Validate -> Enhance -> Deploy pipeline

