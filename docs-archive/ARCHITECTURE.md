# Interview Syntax Drill - Architecture

## Data Model

### Pattern
```
{
  id: string (unique, kebab-case)
  name: string (display name)
  snippets: Snippet[]
}
```

### Snippet
```
{
  id: string (unique within pattern)
  title: string (e.g. "Convergence (Inward)")
  description: string (one sentence)
  code: string (the canonical implementation)
  testCode: string (executes the code)
  expectedOutput: string (what to compare against)
}
```

## Component Structure

### Single component: Home (page.js)

State:
- `selectedPattern` (string, pattern id)
- `selectedSnippetId` (string, snippet id)
- `code` (string, current editor content)
- `output` (string, execution output)
- `status` ('idle' | 'running' | 'success' | 'error')

Key functions:
- `handlePatternChange()` - Switch patterns, reset snippet
- `handleSnippetChange()` - Switch snippets within pattern
- `runCode()` - Execute code via `new Function()`, capture console.log
- `nextSnippet()` - Move to next snippet in pattern

Layout:
- Sidebar (56rem width) - Pattern selector
- Header (secondary bg) - Pattern title, snippet title, description
- Main content area (flex, 2 columns):
  - Editor (flex-1) - Code textarea
  - Output (fixed 20rem) - Output display + expected box
- Footer (secondary bg) - Snippet tabs for current pattern

## Styling

Dark theme, brutalist:
- Primary: #0f0f0e (almost black)
- Secondary: #1a1a19 (slightly lighter)
- Accent: #00d9ff (cyan for active/focus)
- Error: #ff4444, Success: #00cc44

Font: system-ui sans-serif for UI, Courier New mono for code.

No animations, minimal transitions (200ms ease on buttons, borders).

## Execution Model

`runCode()` workflow:
1. Wrap function + test code in `new Function()`
2. Create fake console object that captures logs
3. Execute the function
4. Capture and display output
5. Mark status as success/error

This is safe for this use case (trusted snippets only, user-controlled code).

## How to Extend

### Add a Pattern
In `PATTERNS` array, add:
```javascript
{
  id: 'new-pattern',
  name: 'New Pattern Name',
  snippets: [
    // ... snippet objects
  ]
}
```

### Add a Snippet to Existing Pattern
Find pattern, add to `snippets` array.

### Change Styling
Edit `app/globals.css` or update Tailwind config.

### Change Layout
Modify JSX structure in `Home` component (grid/flex classes).

## Performance Notes

- No memoization needed (small component)
- No code splitting needed (single page)
- No API calls (client-only)
- Execution is instant for small JS snippets

## Browser Support

Requires:
- ES6+ (arrow functions, const/let, template literals)
- `new Function()` (all modern browsers)
- Tailwind CSS (all modern browsers)

Tested on: Chrome 120+, Firefox 120+, Safari 17+

