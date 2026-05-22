// scripts/enhance-descriptions.js
// Run with: node scripts/enhance-descriptions.js

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function loadPatterns() {
  const path = "./data/patterns.json";
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  }
  console.error("patterns.json not found. Run generate-patterns.js first.");
  process.exit(1);
}

async function enhanceSnippet(patternName, snippet) {
  console.log(`Enhancing ${patternName} - ${snippet.title}...`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Enhance the description and add gotchas for this interview pattern snippet.

Pattern: ${patternName}
Current Title: ${snippet.title}
Current Description: ${snippet.description}

Code:
\`\`\`javascript
${snippet.code}
\`\`\`

Provide improvements as JSON:
{
  "improvedDescription": "1-2 sentences on when to use this, clearer than current",
  "gotchas": ["gotcha1", "gotcha2", "gotcha3"],
  "timeComplexity": "O(n) or similar",
  "spaceComplexity": "O(1) or similar",
  "realWorldUse": "Where you'd actually see this pattern"
}

Keep descriptions concrete and practical for interview prep. Gotchas should be specific to this pattern (not generic advice).

Return only JSON.`,
      },
    ],
  });

  const responseText = message.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error(`Failed to parse enhancement response:`, responseText);
    return null;
  }
}

async function main() {
  console.log("Enhancing snippet descriptions...\n");

  const patterns = loadPatterns();
  const enhanced = [];
  let count = 0;

  for (const pattern of patterns) {
    console.log(`\nPattern: ${pattern.name}`);
    const enhancedSnippets = [];

    for (const snippet of pattern.snippets) {
      const enhancement = await enhanceSnippet(pattern.name, snippet);

      if (enhancement) {
        const enhanced = {
          ...snippet,
          description: enhancement.improvedDescription,
          gotchas: enhancement.gotchas,
          complexity: {
            time: enhancement.timeComplexity,
            space: enhancement.spaceComplexity,
          },
          realWorldUse: enhancement.realWorldUse,
        };
        enhancedSnippets.push(enhanced);
        console.log(`  ✓ Enhanced: ${snippet.title}`);
        count++;
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    enhanced.push({
      ...pattern,
      snippets: enhancedSnippets,
    });
  }

  // Save enhanced patterns
  fs.writeFileSync(
    "./data/patterns-enhanced.json",
    JSON.stringify(enhanced, null, 2)
  );

  console.log("\n" + "=".repeat(50));
  console.log(`Enhanced ${count} snippets`);
  console.log(`Saved to data/patterns-enhanced.json`);
  console.log("\nNext: Compare with original and copy into app/page.js");
}

main().catch(console.error);
