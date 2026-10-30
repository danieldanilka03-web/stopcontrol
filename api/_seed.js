export default {
 "users": [
  {
   "id": "u1",
   "name": "Алексеев М. С.",
   "email": "alexeev@transcontrol.gov",
   "role": "admin",
   "city": "Великий Новгород",
   "district": "Софийская сторона",
   "active": true
  },
  {
   "id": "u2",
   "name": "Смирнов А. В.",
   "email": "smirnov@transcontrol.gov",
   "role": "inspector",
   "city": "Великий Новгород",
   "district": "Западный район",
   "active": true
  },
  {
   "id": "u3",
   "name": "Ковалева Е. Н.",
   "email": "kovaleva@transcontrol.gov",
   "role": "dispatcher",
   "city": "Великий Новгород",
   "district": "Торговая сторона",
   "active": true
  },
  {
   "id": "u4",
   "name": "Иванов С. П.",
   "email": "ivanov@mail.ru",
   "role": "citizen",
   "city": "Великий Новгород",
   "district": "Северный район",
   "active": true
  }
 ],
 "stops": [
  {
   "id": "stop-vn-1",
   "name": "Кремлёвский парк / Сенная площадь",
   "city": "Великий Новгород",
   "district": "Софийская сторона",
   "lat": 58.5218,
   "lng": 31.2715,
   "routes": "Автобус 1, 2, 4, 9, 101; Маршрутка 19",
   "status": "good",
   "installedDate": "2023-05-18",
   "equipment": [
    "Умный павильон",
    "Скамья из лиственницы",
    "Электронное табло",
    "LED-освещение",
    "Тактильная плитка",
    "Видеонаблюдение"
   ],
   "photo": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-vn-2",
   "name": "Вокзальная площадь (Ж/Д Вокзал)",
   "city": "Великий Новгород",
   "district": "Западный район",
   "lat": 58.5265,
   "lng": 31.2468,
   "routes": "Автобус 4, 8, 20, 26, 35",
   "status": "warning",
   "installedDate": "2022-08-10",
   "equipment": [
    "Навес",
    "Скамья",
    "Электронное табло",
    "Урна"
   ],
   "photo": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-vn-3",
   "name": "Ул. Большая Санкт-Петербургская / Завод Волна",
   "city": "Великий Новгород",
   "district": "Северный район",
   "lat": 58.5392,
   "lng": 31.2675,
   "routes": "Автобус 9, 12, 14, 101",
   "status": "danger",
   "installedDate": "2021-04-22",
   "equipment": [
    "Навес",
    "Скамья",
    "Урна"
   ],
   "photo": "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-1",
   "name": "Пл. Ленина (Метро)",
   "city": "Новосибирск",
   "district": "Центральный район",
   "lat": 55.0302,
   "lng": 82.9204,
   "routes": "Автобус 13, 28; Троллейбус 5, 29",
   "status": "good",
   "installedDate": "2023-04-12",
   "equipment": [
    "Навес",
    "Скамья",
    "Электронное табло",
    "LED-освещение",
    "Тактильная плитка"
   ],
   "photo": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-2",
   "name": "Станция Метро «Студенческая»",
   "city": "Новосибирск",
   "district": "Ленинский район",
   "lat": 54.9892,
   "lng": 82.9056,
   "routes": "Автобус 45, 11; Маршрутка 63",
   "status": "warning",
   "installedDate": "2022-09-18",
   "equipment": [
    "Навес",
    "Скамья",
    "Урна",
    "LED-освещение"
   ],
   "photo": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-3",
   "name": "Пл. Карла Маркса (ТЦ Гранит)",
   "city": "Новосибирск",
   "district": "Ленинский район",
   "lat": 54.9831,
   "lng": 82.8933,
   "routes": "Трамвай 14; Автобус 29, 60",
   "status": "danger",
   "installedDate": "2021-06-05",
   "equipment": [
    "Навес",
    "Скамья",
    "Урна"
   ],
   "photo": "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-5",
   "name": "Тверская площадь / Мэрия",
   "city": "Москва",
   "district": "Центральный АО",
   "lat": 55.7615,
   "lng": 37.6086,
   "routes": "Автобус м1, м10, е30",
   "status": "good",
   "installedDate": "2024-01-10",
   "equipment": [
    "Умный павильон",
    "USB-зарядки",
    "Электронное табло",
    "Wi-Fi"
   ],
   "photo": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-6",
   "name": "Невский проспект (Гостиный Двор)",
   "city": "Санкт-Петербург",
   "district": "Центральный район",
   "lat": 59.9338,
   "lng": 30.334,
   "routes": "Автобус 3, 7, 22, 24, 27",
   "status": "warning",
   "installedDate": "2023-05-15",
   "equipment": [
    "Стеклянный навес",
    "Электронное табло",
    "Освещение"
   ],
   "photo": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-psk-1",
   "name": "Площадь Ленина / Псковский Кремль",
   "city": "Псков",
   "district": "Центр",
   "lat": 57.8202,
   "lng": 28.3315,
   "routes": "Автобус 1, 3, 4, 11, 14, 17",
   "status": "good",
   "installedDate": "2023-06-12",
   "equipment": [
    "Навес",
    "Скамья",
    "Электронное табло",
    "Освещение"
   ],
   "photo": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-tv-1",
   "name": "Площадь Михаила Тверского",
   "city": "Тверь",
   "district": "Центральный район",
   "lat": 56.8601,
   "lng": 35.9085,
   "routes": "Автобус 1, 7, 15, 20, 21",
   "status": "warning",
   "installedDate": "2022-11-05",
   "equipment": [
    "Навес",
    "Скамья",
    "Урна"
   ],
   "photo": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80"
  },
  {
   "id": "stop-vlg-1",
   "name": "Кремлёвская площадь",
   "city": "Вологда",
   "district": "Центральный район",
   "lat": 59.2238,
   "lng": 39.8836,
   "routes": "Автобус 1, 6, 8, 16, 19",
   "status": "good",
   "installedDate": "2023-09-01",
   "equipment": [
    "Резной павильон",
    "Скамья",
    "Освещение",
    "Табло"
   ],
   "photo": "https://images.unsplash.com/photo-1544620347-cfd4a3d5957?w=600&auto=format&fit=crop&q=80"
  }
 ],
 "tickets": [
  {
   "id": "TICK-101",
   "stopId": "stop-vn-3",
   "stopName": "Ул. Большая Санкт-Петербургская / Завод Волна",
   "city": "Великий Новгород",
   "author": "Смирнов А. В. (Инспектор)",
   "category": "Разбито стекло / остекление",
   "severity": "critical",
   "status": "new",
   "contractor": "Не назначен",
   "sla": "6 часов",
   "createdDate": "2026-09-28 07:15",
   "description": "Разбита задняя ветрозащитная стеклянная секция павильона. Осколки на тротуаре.",
   "photo": null
  },
  {
   "id": "TICK-102",
   "stopId": "stop-vn-2",
   "stopName": "Вокзальная площадь (Ж/Д Вокзал)",
   "city": "Великий Новгород",
   "author": "Иванов С. П. (Житель)",
   "category": "Не работает освещение",
   "severity": "medium",
   "status": "in_progress",
   "contractor": "МУП «ГорСвет»",
   "sla": "24 часа",
   "createdDate": "2026-09-27 18:30",
   "description": "В темное время не включаются светодиодные линейки подсветки расписания.",
   "photo": null
  },
  {
   "id": "TICK-103",
   "stopId": "stop-1",
   "stopName": "Пл. Ленина (Метро)",
   "city": "Новосибирск",
   "author": "Ковалева Е. Н.",
   "category": "Вандализм / Граффити",
   "severity": "low",
   "status": "review",
   "contractor": "МКУ «Чистый Город»",
   "sla": "48 часов",
   "createdDate": "2026-09-26 12:00",
   "description": "Смывка надписей на боковой панели остановки.",
   "photo": null
  },
  {
   "id": "TICK-104",
   "stopId": "stop-6",
   "stopName": "Невский проспект (Гостиный Двор)",
   "city": "Санкт-Петербург",
   "author": "Житель города",
   "category": "Поломка электронного табло",
   "severity": "medium",
   "status": "done",
   "contractor": "ООО «РемТрансСервис»",
   "sla": "24 часа",
   "createdDate": "2026-09-25 09:20",
   "description": "Перезагрузка блока индикации табло.",
   "photo": null
  }
 ],
 "inspections": [
  {
   "id": "INS-2001",
   "stopId": "stop-vn-2",
   "stopName": "Вокзальная площадь (Ж/Д Вокзал)",
   "city": "Великий Новгород",
   "inspector": "Смирнов А. В.",
   "date": "2026-09-27 09:40",
   "result": "warning",
   "notes": "Не работает подсветка расписания. Остальные элементы в норме.",
   "results": [
    {
     "item": "Остекление и ветрозащитные стенки",
     "value": "ok"
    },
    {
     "item": "Кровля, навес и водосточные желоба",
     "value": "ok"
    },
    {
     "item": "Скамья ожидания (доски, крепления)",
     "value": "ok"
    },
    {
     "item": "Урна для мусора (целостность, чистота)",
     "value": "ok"
    },
    {
     "item": "Информационное электронное табло",
     "value": "ok"
    },
    {
     "item": "Система освещения (светильники, проводка)",
     "value": "warning"
    },
    {
     "item": "Тактильная плитка и подходы",
     "value": "ok"
    },
    {
     "item": "Отсутствие граффити и наклеек",
     "value": "ok"
    }
   ],
   "photo": null
  },
  {
   "id": "INS-2002",
   "stopId": "stop-vn-3",
   "stopName": "Ул. Большая Санкт-Петербургская / Завод Волна",
   "city": "Великий Новгород",
   "inspector": "Смирнов А. В.",
   "date": "2026-09-28 07:05",
   "result": "danger",
   "notes": "Разбита задняя ветрозащитная секция. Есть угроза для пассажиров.",
   "results": [
    {
     "item": "Остекление и ветрозащитные стенки",
     "value": "danger"
    },
    {
     "item": "Кровля, навес и водосточные желоба",
     "value": "ok"
    },
    {
     "item": "Скамья ожидания (доски, крепления)",
     "value": "warning"
    },
    {
     "item": "Урна для мусора (целостность, чистота)",
     "value": "ok"
    },
    {
     "item": "Информационное электронное табло",
     "value": "ok"
    },
    {
     "item": "Система освещения (светильники, проводка)",
     "value": "ok"
    },
    {
     "item": "Тактильная плитка и подходы",
     "value": "ok"
    },
    {
     "item": "Отсутствие граффити и наклеек",
     "value": "ok"
    }
   ],
   "photo": null
  }
 ]
};
