import { json } from '../route-response.mjs';

export function declareRoutes(ctx) {
  const disposers = [];
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/balance.json', methods: ['GET', 'HEAD'],
    handler: async (req) => {
      try {
        const payload = await ctx.whale.getBalance({ force: new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1' });
        return json(payload);
      } catch (err) {
        return json({ ok: false, code: 'ERROR', error: String((err && err.message) || err).slice(0, 200) });
      }
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/last-turn.json', methods: ['GET', 'HEAD'],
    handler: () => json(ctx.whale.lastTurn()),
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/usage-records.json', methods: ['GET', 'HEAD'],
    handler: async () => {
      try { return json(ctx.whale.usageRecords()); }
      catch (err) { return json({ ok: false, error: String((err && err.message) || err) }); }
    },
  }));
  return disposers;
}
