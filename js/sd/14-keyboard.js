// ============================================================================
// KEYBOARD + BOOT
// ============================================================================
document.addEventListener('keydown', e => {
  if (document.getElementById('stats-modal').classList.contains('is-open')) { if (e.key === 'Escape') closeStats(); return; }
  if (!session) return;
  const it = session.items[session.pos]; if (!it) return;
  const tag = e.target.tagName;
  if (it.type === 'open') {
    if (!session.answered) {
      if ((e.key === 'Enter' || e.key === ' ') && tag !== 'TEXTAREA') { e.preventDefault(); revealOpen(); }
    } else if (/^[1-3]$/.test(e.key)) { e.preventDefault(); gradeOpen({ '1': 'again', '2': 'partial', '3': 'good' }[e.key]); }
    return;
  }
  if (!session.answered) {
    let pick = -1;
    if (/^[a-dA-D]$/.test(e.key)) pick = 'abcd'.indexOf(e.key.toLowerCase());
    else if (/^[1-4]$/.test(e.key)) pick = parseInt(e.key, 10) - 1;
    if (pick >= 0) { e.preventDefault(); selectAnswer(pick); }
  } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); nextQuestion(); }
});

