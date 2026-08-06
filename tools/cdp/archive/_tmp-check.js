const { ensureServer, ensureChrome, connect } = require('../lib');
(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/' });
  await s.waitFor(`typeof selectLesson === 'function'`);
  const out = await s.eval(`JSON.stringify({
    isPartialL1: typeof isPartialL1,
    markPartialL1: typeof markPartialL1,
    statePartial: typeof state.partialL1,
    url: location.href
  })`);
  console.log(out);
  await s.close();
})().catch(e=>{console.error(e);process.exit(2)});
