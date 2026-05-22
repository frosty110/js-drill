// scripts/validate-snippets.js
// Run with: node scripts/validate-snippets.js

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load patterns from page.js (simplified: assumes patterns is exported)
// For now, load from patterns.json if it exists
function loadPatterns() {
  const path = "./data/patterns.json";
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  }
  console.error("patterns.json not found. Run generate-patterns.js first.");
  process.exit(1);
}

async function validateSnippet(patternName, snippet) {
  console.log(`Validating ${patternName} - ${snippet.title}...`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `Validate this JavaScript code snippet for a coding interview pattern.

Pattern: ${patternName}
Title: ${snippet.title}

Code:
\`\`\`javascript
${snippet.code}
\`\`\`

Test Code:
\`\`\`javascript
${snippet.testCode}
\`\`\`

Expected Output:
${snippet.expectedOutput}

Check:
1. Is the code syntactically correct?
2. Does the test code correctly exercise the function?
3. Is the expected output achievable by running the test with the code?
4. Are there obvious bugs or edge case issues?
5. Is the algorithm efficient enough for interviews?

Return ONLY valid JSON (no markdown, no explanation):
{
  "isValid": true/false,
  "syntaxOk": true/false,
  "testOk": true/false,
  "outputOk": true/false,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "severity": "error" | "warning" | "ok"
}`,
      },
    ],
  });

  const responseText = message.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error(`Failed to parse validation response:`, responseText);
    return { isValid: false, issues: ["Failed to validate"], severity: "error" };
  }
}

async function main() {
  console.log("Validating snippets...\n");

  const patterns = loadPatterns();
  const results = [];
  let errorCount = 0;
  let warningCount = 0;
  let okCount = 0;

  for (const pattern of patterns) {
    console.log(`\nPattern: ${pattern.name}`);

    for (const snippet of pattern.snippets) {
      const validation = await validateSnippet(pattern.name, snippet);
      results.push({
        pattern: pattern.name,
        snippet: snippet.title,
        validation,
      });

      if (validation.severity === "error") {
        console.log(`  ✗ ${snippet.title}: ERROR`);
        errorCount++;
      } else if (validation.severity === "warning") {
        console.log(`  ⚠ ${snippet.title}: WARNING`);
        warningCount++;
      } else {
        console.log(`  ✓ ${snippet.title}: OK`);
        okCount++;
      }

      if (validation.issues && validation.issues.length > 0) {
        validation.issues.forEach((issue) => {
          console.log(`    - ${issue}`);
        });
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Save results
  fs.writeFileSync(
    "./data/validation-results.json",
    JSON.stringify(results, null, 2)
  );

  console.log("\n" + "=".repeat(50));
  console.log(`Validation Summary:`);
  console.log(`  ✓ OK: ${okCount}`);
  console.log(`  ⚠ Warnings: ${warningCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);
  console.log(`\nResults saved to data/validation-results.json`);

  if (errorCount > 0) {
    console.log("\nFix errors before deploying!");
    process.exit(1);
  }
}

main().catch(console.error);
