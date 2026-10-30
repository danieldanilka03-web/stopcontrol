import { sql, init, send } from './_lib.js';

const EVENT_MAP = {
  impact: { category: 'Разбито стекло / сильный удар (вандализм)', severity: 'critical', contractor: 'ООО «РемТрансСервис»', label: 'Зафиксирован сильный удар по павильону' },
  glass_break: { category: 'Разбито стекло / остекление', severity: 'critical', contractor: 'ООО «РемТрансСервис»', label: 'Сработал акустический датчик разбития стекла' },
  light_failure: { category: 'Не работает освещение', severity: 'critical', contractor: 'МУП «ГорСвет»', label: 'Обрыв цепи освещения остановочного комплекса' },
  display_error: { category: 'Поломка электронного табло', severity: 'medium', contractor: 'МУП «ГорСвет»', label: 'Потеря связи с электронным табло расписания' },
  ping: { category: 'Телеметрия', severity: 'low', contractor: 'Не назначен', label: 'Штатный опрос датчиков' }
};

const nowStr = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export default async function handler(req, res) {
  try {
    await init();

    if (req.method === 'GET') {
      const [devRow] = await sql`SELECT data FROM collections WHERE key='devices'`;
      const [logRow] = await sql`SELECT data FROM collections WHERE key='telemetry_logs'`;
      return send(res, 200, {
        devices: devRow?.data || [],
        logs: (logRow?.data || []).slice(-30)
      });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Метод не поддерживается' });

    const b = req.body || {};
    const key = String(req.headers['x-device-key'] || b.apiKey || '').trim();
    const deviceId = String(b.deviceId || '').trim();
    const eventType = String(b.event || 'ping').trim();
    const details = String(b.details || '').trim();
    const lux = b.lux !== undefined ? Number(b.lux) : null;
    const gForce = b.gForce !== undefined ? Number(b.gForce) : null;
    const battery = b.battery !== undefined ? Number(b.battery) : 3.9;

    if (!key && !deviceId) {
      return send(res, 400, { error: 'Не указан ключ устройства (X-Device-Key) или deviceId' });
    }

    const rows = await sql`SELECT key, data FROM collections WHERE key IN ('devices', 'stops', 'tickets', 'notifications', 'telemetry_logs')`;
    const col = Object.fromEntries(rows.map(r => [r.key, r.data]));
    const devices = Array.isArray(col.devices) ? col.devices : [];
    const stops = Array.isArray(col.stops) ? col.stops : [];
    let tickets = Array.isArray(col.tickets) ? col.tickets : [];
    let notifications = Array.isArray(col.notifications) ? col.notifications : [];
    let telemetryLogs = Array.isArray(col.telemetry_logs) ? col.telemetry_logs : [];

    let device = devices.find(d => (key && d.apiKey === key) || (deviceId && d.id === deviceId));

    if (!device && key.startsWith('demo_')) {
      const targetStop = stops[0] || { id: 'stop-vn-1', name: 'Кремлёвский парк', city: 'Великий Новгород' };
      device = {
        id: 'dev_' + key.slice(5),
        name: 'Демо-контроллер STM32',
        stopId: targetStop.id,
        stopName: targetStop.name,
        city: targetStop.city,
        apiKey: key,
        status: 'online',
        installedDate: nowStr().split(' ')[0],
        sensors: ['акселерометр MPU6050', 'фоторезистор', 'датчик тока'],
        lastSeen: nowStr()
      };
      devices.push(device);
    }

    if (!device) {
      return send(res, 401, { error: 'Устройство с указанным ключом не найдено в реестре' });
    }

    const stop = stops.find(s => s.id === device.stopId) || { id: device.stopId, name: device.stopName || 'Остановка', city: device.city || 'Великий Новгород' };
    const eventMeta = EVENT_MAP[eventType] || EVENT_MAP.impact;
    const isAlarm = eventType !== 'ping';

    device.lastSeen = nowStr();
    device.status = isAlarm ? 'alarm' : 'online';
    device.lastEvent = eventType;
    device.lastDetails = details || eventMeta.label;

    let newTicket = null;
    if (isAlarm) {
      const ticketId = 'TICK-IoT-' + Math.floor(1000 + Math.random() * 9000);
      const desc = `[Сработал IoT-датчик] ${details || eventMeta.label}. Телеметрия контроллера STM32: перегрузка ${gForce !== null ? gForce + 'g' : 'зафиксирована'}, освещённость ${lux !== null ? lux + ' лк' : '0 лк'}, АКБ: ${battery}В. Заявка сформирована автоматически без участия человека.`;

      newTicket = {
        id: ticketId,
        stopId: stop.id,
        stopName: stop.name,
        city: stop.city,
        author: `IoT-Контроллер (${device.name})`,
        category: eventMeta.category,
        severity: eventMeta.severity,
        status: 'new',
        source: 'sensor',
        contractor: eventMeta.contractor,
        sla: '6 часов (Экстренно)',
        createdDate: nowStr(),
        description: desc,
        photo: null,
        history: [{ at: nowStr(), by: `IoT-Контроллер STM32 (${device.id})`, to: 'new' }]
      };

      tickets.unshift(newTicket);

      const updatedStops = stops.map(s => s.id === stop.id ? { ...s, status: 'danger' } : s);
      await sql`INSERT INTO collections (key, data, updated_at) VALUES ('stops', ${JSON.stringify(updatedStops)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;

      const users = await sql`SELECT id FROM users WHERE role IN ('admin', 'dispatcher')`;
      for (const u of users) {
        notifications.push({
          id: 'n_iot_' + Date.now() + Math.random().toString(36).slice(2, 6),
          userId: u.id,
          ticketId: newTicket.id,
          text: `🚨 Аварийный сигнал с датчика (${device.name}): ${eventMeta.label} на ${stop.name}! Создана заявка ${newTicket.id}.`,
          at: nowStr(),
          read: false
        });
      }
      notifications = notifications.slice(-200);

      await sql`INSERT INTO collections (key, data, updated_at) VALUES
        ('tickets', ${JSON.stringify(tickets)}::jsonb, now()),
        ('notifications', ${JSON.stringify(notifications)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;
    }

    const logEntry = {
      id: 'log_' + Date.now(),
      deviceId: device.id,
      deviceName: device.name,
      stopName: stop.name,
      city: stop.city,
      event: eventType,
      isAlarm,
      lux,
      gForce,
      battery,
      details: details || eventMeta.label,
      at: nowStr(),
      ticketId: newTicket ? newTicket.id : null
    };
    telemetryLogs.push(logEntry);
    telemetryLogs = telemetryLogs.slice(-100);

    await sql`INSERT INTO collections (key, data, updated_at) VALUES
      ('devices', ${JSON.stringify(devices)}::jsonb, now()),
      ('telemetry_logs', ${JSON.stringify(telemetryLogs)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;

    return send(res, 200, {
      ok: true,
      deviceId: device.id,
      ticketCreated: !!newTicket,
      ticketId: newTicket ? newTicket.id : null,
      message: isAlarm ? `Аварийный сигнал зарегистрирован, создан наряд ${newTicket.id}` : 'Телеметрия принята (Heartbeat OK)',
      deviceStatus: device.status
    });
  } catch (err) {
    console.error('Ошибка в api/telemetry:', err);
    return send(res, 500, { error: 'Внутренняя ошибка сервера приёма телеметрии: ' + err.message });
  }
}
