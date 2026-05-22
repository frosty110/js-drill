// scripts/generate-patterns.js
// Run with: node scripts/generate-patterns.js

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PATTERN_NAMES = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Tries",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Dynamic Programming",
];

async function generateSnippet(patternName, snippetIndex) {
  console.log(`Generating ${patternName} snippet ${snippetIndex + 1}...`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Generate a JavaScript snippet for the "${patternName}" coding interview pattern.

Snippet ${snippetIndex + 1} of 2 for this pattern.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Short descriptive title",
  "description": "One sentence explaining when to use this",
  "code": "function name() { ... }",
  "testCode": "const result = name(...); console.log(JSON.stringify(result));",
  "expectedOutput": "what console.log should print"
}

Requirements:
- code must be complete, runnable JavaScript
- testCode must call the function and log output
- expectedOutput must be achievable by running testCode with the code
- avoid complex test data; keep it simple (arrays of 1-10 numbers)
- include a comment in code explaining the algorithm briefly
- function name should be descriptive

Return only JSON, nothing else.`,
      },
    ],
  });

  const responseText = message.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error(`Failed to parse response for ${patternName}:`, responseText);
    return null;
  }
}

async function generatePattern(patternName) {
  const id = patternName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const snippets = [];

  for (let i = 0; i < 2; i++) {
    const snippet = await generateSnippet(patternName, i);
    if (snippet) {
      snippet.id = `${id}-snippet-${i + 1}`;
      snippets.push(snippet);
    }
    // Rate limit: 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (snippets.length === 0) {
    console.error(`Failed to generate snippets for ${patternName}`);
    return null;
  }

  return {
    id,
    name: patternName,
    snippets,
  };
}

async function main() {
  console.log("Generating interview patterns...\n");

  const patterns = [];

  for (const patternName of PATTERN_NAMES) {
    const pattern = await generatePattern(patternName);
    if (pattern) {
      patterns.push(pattern);
      console.log(`✓ Generated: ${patternName}\n`);
    }
  }

  // Save to file
  const outputPath = "./data/patterns.json";
  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(patterns, null, 2));

  console.log(`\n✓ Saved ${patterns.length} patterns to ${outputPath}`);
  console.log("\nNext steps:");
  console.log("1. Review patterns.json for quality");
  console.log("2. Copy patterns into app/page.js PATTERNS array");
  console.log("3. Test in browser: npm run dev");
}

main().catch(console.error);
