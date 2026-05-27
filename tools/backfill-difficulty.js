#!/usr/bin/env node
// One-shot: backfill `tags.difficulty` onto every patterns+applied lesson entry
// in data/manifest.json. Difficulty follows the canonical LeetCode rating for
// the real LC problems; the s-* algorithm-boilerplate and a-* applied lessons
// are rated by judgment of conceptual load. Idempotent — re-running overwrites
// difficulty to the map value and leaves any company[] tags untouched.
const fs = require('fs');
const path = require('path');
const MAN = path.join(__dirname, '..', 'data', 'manifest.json');

const DIFF = {
  // Algorithms (pattern-prerequisite boilerplate)
  'sorting': 'easy', 's-stack-pattern': 'easy', 's-queue-pattern': 'easy',
  's-bfs-template': 'medium', 's-matrix-neighbors': 'easy', 's-tree-traversals': 'easy',
  's-ll-traversal': 'easy', 's-ll-fast-slow': 'medium', 's-heap-ops': 'medium',
  's-index-math': 'easy', 's-bigo-intuition': 'medium',
  // Arrays & Hashing
  'two-sum': 'easy', 'p-contains-dup': 'easy', 'p-anagrams': 'medium',
  'p-valid-anagram': 'easy', 'p-encode-decode-strings': 'medium', 'p-longest-consecutive': 'medium',
  // Two Pointers
  'valid-palindrome': 'easy', 'p-3sum': 'medium', 'p-container': 'medium', 'p-trapping-rain': 'hard',
  // Sliding Window
  'best-time-stock': 'easy', 'p-longest-sub': 'medium', 'p-min-window': 'hard', 'p-sliding-window-max': 'hard',
  // Stack
  'valid-parentheses': 'easy', 'p-daily-temp': 'medium', 'p-min-stack': 'medium', 'p-largest-rect-hist': 'hard',
  // Binary Search
  'binary-search': 'easy', 'p-rotated': 'medium', 'p-koko-bananas': 'medium', 'p-min-rotated': 'medium',
  // Linked List
  'p-reverse-list': 'easy', 'p-cycle': 'easy', 'p-merge-k-lists': 'hard', 'p-add-two-numbers': 'medium',
  'p-merge-two-sorted': 'easy', 'p-remove-nth': 'medium', 'p-reorder-list': 'medium',
  // Trees
  'p-max-depth': 'easy', 'p-invert': 'easy', 'p-bfs': 'medium', 'p-valid-bst': 'medium',
  'p-lca-bst': 'medium', 'p-construct-tree': 'medium', 'p-max-path-sum': 'hard', 'p-same-tree': 'easy',
  'p-serialize-tree': 'hard',
  // Tries
  'p-trie': 'medium', 'p-word-search-ii': 'hard',
  // Heap
  'p-kth-largest': 'medium', 'p-min-heap': 'medium', 'p-top-k-frequent': 'medium', 'p-median-data-stream': 'hard',
  // Graphs
  'p-islands': 'medium', 'p-course': 'medium', 'p-clone-graph': 'medium', 'p-connected-components': 'medium',
  'p-course-ii': 'medium', 'p-num-provinces': 'medium', 'p-pacific-atlantic': 'medium',
  // Greedy
  'p-gas-station': 'medium', 'p-jump-game': 'medium', 'p-max-subarray': 'medium',
  // Dynamic Programming
  'p-climbing-stairs': 'easy', 'p-house-robber': 'medium', 'p-coin-change': 'medium',
  'p-longest-inc-sub': 'medium', 'p-word-break': 'medium', 'p-edit-distance': 'medium',
  'p-longest-common-subseq': 'medium', 'p-max-product-subarray': 'medium', 'p-unique-paths': 'medium',
  // Backtracking
  'p-subsets': 'medium', 'p-permutations': 'medium', 'p-combination-sum': 'medium', 'p-word-search': 'medium',
  // Intervals
  'p-insert-interval': 'medium', 'p-meeting-rooms-ii': 'medium', 'p-merge-intervals': 'medium',
  // Matrix
  'p-rotate-image': 'medium', 'p-set-matrix-zeroes': 'medium', 'p-spiral-matrix': 'medium',
  // Bit Manipulation
  'p-single-number': 'easy', 'p-count-bits': 'easy', 'p-missing-number': 'easy',
  'p-num-1-bits': 'easy', 'p-reverse-bits': 'easy',
  // System Design
  'p-lru-cache': 'medium',
  // Applied — implementation problems (judgment)
  'a-blackjack-hand': 'easy', 'a-circular-buffer': 'medium', 'a-connect-four': 'medium',
  'a-curry': 'medium', 'a-debounce': 'medium', 'a-deck-cards': 'easy', 'a-deep-clone': 'medium',
  'a-event-emitter': 'medium', 'a-game-of-life': 'medium', 'a-hashmap': 'medium', 'a-memoize': 'medium',
  'a-minesweeper': 'medium', 'a-poker-rank': 'hard', 'a-promise-all': 'medium',
  'a-queue-from-stacks': 'easy', 'a-shopping-cart': 'easy', 'a-snake-game': 'medium',
  'a-throttle': 'medium', 'a-tic-tac-toe': 'easy', 'a-undo-redo': 'medium',
  // Applied — Eve legal-domain
  'a-eve-demand-letter': 'medium', 'a-eve-medical-chronology': 'medium', 'a-eve-treatment-gaps': 'medium',
  'a-eve-bates-numbering': 'easy', 'a-eve-damages-rollup': 'medium', 'a-eve-sol-deadline': 'medium',
  'a-eve-record-dedup': 'medium', 'a-eve-pii-redaction': 'medium', 'a-eve-intake-completeness': 'medium',
  'a-eve-conflict-check': 'medium', 'a-eve-citation-extract': 'medium', 'a-eve-update-propagation': 'hard'
};

const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
let tagged = 0, missing = [];
for (const sec of man.sections) {
  for (const l of sec.lessons) {
    if (l.track !== 'patterns' && l.track !== 'applied') continue;
    const d = DIFF[l.id];
    if (!d) { missing.push(l.id); continue; }
    l.tags = Object.assign({}, l.tags, { difficulty: d });
    tagged++;
  }
}
if (missing.length) {
  console.error('NO difficulty mapping for: ' + missing.join(', '));
  process.exit(1);
}
fs.writeFileSync(MAN, JSON.stringify(man, null, 2) + '\n');
console.log(`Tagged difficulty on ${tagged} Problems lessons. manifest.json rewritten.`);
