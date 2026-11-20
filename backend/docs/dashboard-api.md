# API дашборду та сповіщень (Розробник 1)

Усі маршрути вимагають `Authorization: Bearer <token>`. Час — у поясі `APP_TIMEZONE` (за замовчуванням `Europe/Kyiv`).
Одиниці: у БД — Вт / Вт·год, у відповідях додатково кВт / кВт·год (3 знаки), гроші — 2 знаки.

## GET /api/dashboard/summary  (UI-01, UI-02)

```json
{
  "active_devices": 2,
  "total_power_watts": 1150,
  "total_power_kw": 1.15,
  "battery_reserve_wh": 5000,
  "battery_reserve_kwh": 5,
  "savings": { "cost_uah": 30.6, "energy_kwh": 1.8 },
  "last_schedule": {
    "id": "09c3c2d4-9c08-47ad-bef4-6e324266e858",
    "strategy": "cost_min",
    "schedule_date": "2026-11-19",
    "total_energy_kwh": 12.3,
    "total_cost_uah": 80.5,
    "created_at": "2026-11-20T08:37:09.636Z"
  },
  "next_outage": {
    "is_active": false,
    "start": "20:00",
    "end": "22:00",
    "starts_in_minutes": 10,
    "ends_in_minutes": 130,
    "duration_minutes": 120
  },
  "generated_at": "2026-11-19T17:50:00.000Z"
}
```

| Поле | Як рахується |
|---|---|
| `active_devices`, `total_power_*` | прилади користувача з `is_active = true` |
| `battery_reserve_*` | сума `capacity_wh` джерел типу `inverter_battery` і `station` (генератор не враховується) |
| `savings` | `baseline − оптимізований` за **останнім** розкладом; `null`, якщо розкладів немає або в `schedule_data` немає `baseline` |
| `last_schedule` | останній запис `schedules` користувача або `null` |
| `next_outage` | найближче/поточне відключення за `users.outage_schedule` або `null`, якщо графік порожній |

Для блоку Power Availability: `next_outage.start`–`end`; якщо `is_active = true` — відключення вже триває.
Якщо відключення цілодобове: `start = end = "00:00"`, `ends_in_minutes = null`, `duration_minutes = 1440`.

## GET /api/dashboard/notifications  (UI-03)

```json
{
  "next_outage": { "is_active": false, "start": "20:00", "end": "22:00", "starts_in_minutes": 10, "ends_in_minutes": 130, "duration_minutes": 120 },
  "warn_before_minutes": 15,
  "should_warn": true,
  "critical_devices": [ { "id": "91f93df1-288f-4e33-89a7-d9e09a422294", "title": "Насос", "power_watts": 1000 } ],
  "generated_at": "2026-11-19T17:50:00.000Z"
}
```

* `critical_devices` — активні прилади з `allow_backup_power = false` (найпотужніші першими).
* `should_warn` = відключення ще не почалось **і** `starts_in_minutes <= warn_before_minutes` **і** є критичні прилади.
  Фронтенд може просто опитувати цей маршрут раз на 1–5 хв і показувати попередження, коли `should_warn === true`.

## Формат `users.outage_schedule` (контракт для PATCH /api/auth/settings та ALG-03)

Масив елементів двох видів (можна змішувати):

* `"HH:00"` — годинний слот `[HH:00; HH+1:00)`, так працює сітка з 24 клітинок на екрані Parameters;
* `{ "start": "HH:MM", "end": "HH:MM" }` — інтервал; кінець не включається; `end <= start` означає перехід через північ.

Приклад: `["00:00", "12:00", { "start": "20:00", "end": "21:30" }]`.
Дані вводить користувач вручну (OUT-01: зовнішні джерела не використовуються).

Для алгоритмів (Розробник 2) є готові функції в `src/utils/outage.ts`:
`buildOutageMask(schedule)` — 1440 булевих значень (по хвилині), `hourlyOutageMask(schedule)` — 24 значення
(година вважається відключеною, якщо хоч одна її хвилина потрапляє у відключення).

## Контракт із Розробником 2 (потрібно погодити)

Щоб `savings` працював, `POST /api/schedules/generate` має зберігати в `schedules.schedule_data`:

```json
{ "baseline": { "total_cost_uah": 111.1, "total_energy_kwh": 14.1 } }
```

`schedules.total_cost_uah` / `total_energy_kwh` — це **оптимізований** сценарій.
