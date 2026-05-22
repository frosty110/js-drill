# Interview Syntax Drill - Quick Reference

## What This App Does

A brutalist code drill for interview prep. You pick a pattern (Two Pointers, Sliding Window, etc.), see canonical snippets, edit them, run them, verify output. That's it.

## Included Patterns (Initial 5)

1. **Two Pointers** - Convergence, sequence moving
2. **Sliding Window** - Fixed and variable size windows
3. **Hash Map / Set** - Frequency counting, deduplication
4. **Binary Search** - Standard search, left/right bounds
5. **Recursion / Backtracking** - Factorial, backtrack template

Each pattern has 2 snippets. One problem per pattern initially.

## How to Use

1. Pick pattern from left sidebar
2. See snippet title + description at top
3. Edit code in textarea if needed
4. Click "Run" to execute against test case
5. See output on right, compare to expected
6. Click "Next Snippet" to move through pattern variants
7. Repeat for next pattern

## Adding More Patterns

### Quick Way (Manual)

1. Edit `app/page.js`
2. Find the `PATTERNS` array
3. Add new pattern object:

```javascript
{
  id: 'pattern-slug',
  name: 'Pattern Name',
  snippets: [
    {
      id: 'snippet-id',
      title: 'Snippet Title',
      description: 'One sentence explaining when to use',
      code: `// complete runnable code`,
      testCode: `// code that calls the function`,
      expectedOutput: 'what console.log should print'
    }
  ]
}
```

4. Reload browser (dev server auto-refreshes)

### AI Way (Using Claude)

See `AGENTIC_GUIDE.md` for how to use Claude Code to generate 10+ patterns at once.

## Tech Stack

- React (hooks only, no classes)
- Next.js (for routing + dev server)
- Tailwind (styling)
- Vanilla JS execution (no external runtime, no transpiling)

## Deployment

```bash
npm run build
npm run start
```

Or deploy to Vercel (one-click, free tier works):
```bash
git push origin main
# Vercel auto-deploys
```

## Features

- Live code editor with syntax highlighting
- Execute JavaScript directly in browser
- Compare output to expected result
- Dark brutalist UI (no animations, no bloat)
- Mobile-responsive layout
- No database, no API calls, all local

## Notes

- No tests (as requested)
- No auth or persistence
- All snippets in code (easy to iterate)
- Runs JS via `new Function()` (safe for trusted snippets)
- Zero external dependencies beyond Next.js/React/Tailwind

