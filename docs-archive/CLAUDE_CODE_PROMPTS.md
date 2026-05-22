# CLAUDE_CODE_PROMPTS.md - Ready-to-Use Commands

Copy and paste these into Claude Code for rapid iteration on the app.

---

## Pattern Generation

### Generate 10 NeetCode Patterns at Once

```
Read interview-syntax-drill/claude.md and app/page.js to understand the app structure.

Generate 10 JavaScript interview patterns covering:
- Arrays & Hashing (2 snippets)
- Two Pointers (2 snippets)
- Sliding Window (2 snippets)
- Stack (2 snippets)
- Binary Search (2 snippets)
- Linked List (2 snippets)
- Trees (2 snippets)
- Tries (2 snippets)
- Heap / Priority Queue (2 snippets)
- Graphs (2 snippets)

For each pattern, generate 2 snippets with:
- title: descriptive name
- description: when to use (1 sentence)
- code: complete, runnable JavaScript
- testCode: code that calls the function and logs output
- expectedOutput: what console.log should print

Save as data/patterns-batch-1.json in the format:
[
  {
    id: "kebab-case-name",
    name: "Pattern Name",
    snippets: [...]
  }
]

Keep code snippets simple (max 20 lines), test data small (arrays of 5-10 elements).
```

### Fix a Broken Snippet

```
This snippet in my app is broken. Fix it and explain what was wrong:

Code:
[paste code here]

Test:
[paste testCode here]

Expected:
[paste expectedOutput here]

Error: [paste error message or describe issue]

Return the corrected JSON object with fixed code.
```

---

## Validation & Quality

### Run Full Validation Pipeline

```
Read AGENTIC_WORKFLOW.md and scripts/validate-snippets.js.

Run the validation pipeline on data/patterns.json:
1. For each snippet, analyze: syntax, test correctness, expected output achievability
2. Flag any errors or warnings
3. Suggest fixes for broken snippets
4. Generate validation-results.json

Output:
- Total snippets checked
- Errors found (with details)
- Warnings (with suggestions)
- % pass rate
```

### Improve All Descriptions

```
Read scripts/enhance-descriptions.js and app/page.js.

For each snippet in data/patterns.json, improve:
1. Description: Make it more concrete, less generic
2. Add 3 gotchas: Common mistakes for this pattern
3. Add complexity: Time and space
4. Add real-world use: Where you'd see this in production code

Output patterns-enhanced.json with the new fields added.
Format each gotcha as: "Watch out: [specific mistake]"
```

---

## App Features

### Add a New Feature: Multiple Test Cases

```
Currently the app shows one test case per snippet.

Add support for multiple test cases per snippet:
1. Update the Snippet data structure in app/page.js to have testCases: [{input, expectedOutput}, ...]
2. Add a test case selector (buttons at bottom of output area)
3. Update runCode() to execute the selected test case
4. Update the "Expected" box to show the current test case's expected output

Show me the changes needed. Keep it minimal.
```

### Add Complexity Display

```
Enhance the snippet display to show time/space complexity:

1. Update snippet structure to include: { timeComplexity: "O(n)", spaceComplexity: "O(1)" }
2. Add a new section below the description showing complexity
3. Style it with smaller text, muted color (grey)
4. Show: "Time: O(n) | Space: O(1)"

Minimal code changes, no big refactor.
```

### Add Dark Mode Toggle (Already Dark, Skip)

```
Add a light mode option to the app:
1. Add a toggle button in the header (sun/moon icon)
2. Store preference in localStorage
3. Adjust colors: backgrounds, text, accents for light mode
4. Update Tailwind classes to handle both themes

Keep the dark theme as default.
```

---

## Debugging

### Diagnose Test Failure

```
This test is failing. Debug it:

Snippet: [paste code]
Test: [paste testCode]
Expected: [paste expectedOutput]
Actual: [paste actual output or error]

Walk through the code step-by-step. Where does it diverge from expected?
Suggest a fix.
```

### Verify Snippet Runs

```
I need to verify this snippet runs without error:

Code:
[paste]

Test:
[paste]

Simulate the execution in your head:
1. What does the function do?
2. What does the test do?
3. What should console.log print?
4. Would it cause an error? If so, where?

Tell me: Pass or Fail? Why?
```

---

## Batch Operations

### Export Patterns to External Format

```
Export the patterns from data/patterns.json to a markdown file:

For each pattern:
- Pattern name (h2)
- Description (p)
- For each snippet:
  - Snippet title (h3)
  - Code block (with language: javascript)
  - Test code block
  - Expected output (blockquote)
  - Gotchas (ul)

Output: data/patterns.md
Goal: Easy to review and share.
```

### Generate Study Guide

```
Create a "Study Guide" markdown file from the patterns:

Structure:
- Intro: "60 essential patterns for interview prep"
- For each pattern:
  - Summary (what it's good for)
  - When to use (decision tree: "Use this when...")
  - Time complexity (best/avg/worst)
  - Space complexity
  - Common mistakes (gotchas)
  - Example (the first snippet)

Output: data/STUDY_GUIDE.md
Goal: Standalone reference without running the app.
```

### Add Pattern Metadata

```
Enhance patterns with metadata:

Add to each pattern:
- difficulty: "easy" | "medium" | "hard"
- neetcodeUrl: link to NeetCode problem (if exists)
- companiesThatAsk: ["Google", "Meta", "etc"]
- relatedPatterns: ["Two Pointers", "etc"]

This enables filtering by difficulty, company, etc.

Update data/patterns.json with these fields.
Output which patterns still need metadata filled in.
```

---

## Performance & Optimization

### Analyze App Performance

```
Review the app code (app/page.js) for performance issues:

Check:
1. Unnecessary re-renders
2. Inefficient state management
3. Large inline objects/arrays
4. Missing memoization
5. DOM operations

Output a brief report with recommendations.
No code changes needed, just analysis.
```

### Optimize Code Execution

```
The app runs code with new Function(). Optimize this:

1. Analyze current execution model
2. Suggest safety improvements
3. Suggest performance improvements (if any)
4. Keep execution time fast (< 100ms for test snippets)

Output: Updated runCode() function if needed.
```

---

## Integration

### Sync with NeetCode

```
Check the NeetCode problem list and compare to our patterns.

1. What patterns do we have?
2. What patterns are we missing?
3. Which are high-priority (most interviewed)?

Output a markdown table:
| Pattern | We Have | Priority | Notes |
| --- | --- | --- | --- |

Use this to prioritize which patterns to generate next.
```

---

## Deployment

### Generate Deployment Checklist

```
Create a pre-deployment checklist for the app:

- [ ] All snippets validated
- [ ] No console errors in browser
- [ ] All test cases pass
- [ ] UI responsive on mobile
- [ ] Load time < 2s
- [ ] Code formatted and clean
- [ ] Documentation updated
- [ ] Patterns.json synced with app/page.js

Output: DEPLOY_CHECKLIST.md

Also output: "Run this before deploying"
```

---

## How to Use These Prompts

1. Open Claude Code (or use API directly)
2. Copy a prompt from above
3. Paste into Claude
4. Claude executes and outputs results
5. Review, integrate, test

Example workflow:

```bash
# Week 1: Build foundation (already done)
# Week 2: Expand patterns
ask_claude_code "Generate 10 NeetCode Patterns at Once"
# Review data/patterns-batch-1.json
cp data/patterns-batch-1.json data/patterns.json

# Week 3: Improve quality
node scripts/validate-snippets.js
ask_claude_code "Run Full Validation Pipeline"

# Week 4: Ship
npm run build
# deploy to Vercel
```

