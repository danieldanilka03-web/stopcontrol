// Бизнес-правила записи данных. Чистые функции: используются и сервером, и демо-предпросмотром.
const ST = ['good', 'warning', 'danger'], TS = ['new', 'in_progress', 'review', 'done'];
const LBL = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Выполнена' };
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
export const assigned = (u, s) => u.role !== 'inspector' || !u.district || s.district === u.district;

function notice(t, to, actor, users) {
  const r = users.find(u => u.id === t.authorId) || users.find(u => t.author && t.author.startsWith(u.name));
  if (!r || r.id === actor.id) return null;
  return { id: 'n_' + Date.now() + Math.random().toString(36).slice(2, 6), userId: r.id, ticketId: t.id, text: `Заявка ${t.id}: статус «${LBL[to]}»`, at: now(), read: false };
}

export function applyWrite(key, inc, cur, user, ctx) {
  const err = error => ({ error });
  if (!Array.isArray(inc)) return err('Ожидается массив');
  const role = user.role, byId = new Map(cur.map(x => [x.id, x])), incIds = new Set(inc.map(x => x && x.id));
  if (key === 'devices') {
    if (role !== 'admin') return err('Управлять устройствами может только администратор');
    return { data: inc, notes: [] };
  }
  if (key === 'stops') {
    if (role === 'admin') return { data: inc, notes: [] };
    if (cur.some(x => !incIds.has(x.id)) || inc.some(x => !byId.has(x.id))) return err('Добавлять и удалять остановки может только администратор');
    return { data: cur.map(s => { const n = inc.find(x => x.id === s.id); return ST.includes(n.status) ? { ...s, status: n.status } : s; }), notes: [] };
  }
  const fresh = inc.filter(x => x && x.id && !byId.has(x.id)).slice(0, role === 'citizen' ? 5 : 20);
  for (const x of fresh) {
    const s = ctx.stops.find(v => v.id === x.stopId);
    if (!s) return err('Остановка не найдена');
    if (!assigned(user, s)) return err('Эта остановка не закреплена за вами');
  }
  if (key === 'inspections') {
    return { data: cur.concat(fresh.map(x => ({ ...x, inspector: user.name, inspectorId: user.id }))), notes: [] };
  }
  const notes = [];
  let base = role === 'admin' ? cur.filter(t => incIds.has(t.id)) : cur;
  if (role === 'admin' || role === 'dispatcher') {
    base = base.map(t => {
      const n = inc.find(x => x.id === t.id); if (!n) return t;
      const u = { ...t };
      if (TS.includes(n.status) && n.status !== t.status) {
        u.status = n.status; u.history = [...(t.history || []), { at: now(), by: user.name, from: t.status, to: n.status }];
        const m = notice(t, n.status, user, ctx.users); if (m) notes.push(m);
      }
      if (typeof n.contractor === 'string') u.contractor = n.contractor;
      if (typeof n.sla === 'string') u.sla = n.sla;
      return u;
    });
  }
  return { data: base.concat(fresh.map(x => ({ ...x, status: 'new', contractor: 'Не назначен', authorId: user.id, history: [{ at: now(), by: user.name, to: 'new' }] }))), notes };
}
