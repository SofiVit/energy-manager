// backend/src/math/scheduler.ts

export interface ApplianceTask {
  id: string;
  title: string;
  powerWatts: number;
  durationMinutes: number;
  isShiftable: boolean; 
  priority: number;     
}

export interface HourlyLoadPoint {
  hour: number;
  totalPowerKw: number;
  activeDevices: string[];
}

export function generateSmartSchedule(
  tasks: ApplianceTask[],
  maxPowerLimitKw: number,
  optimizeForEconomy: boolean = true
): HourlyLoadPoint[] {
  // Використовуємо звичайний масив з 24 елементів, щоб уникнути помилок undefined
  const schedule: { powerKw: number; devices: string[] }[] = Array.from({ length: 24 }, () => ({
    powerKw: 0,
    devices: [],
  }));

  const fixedTasks = tasks.filter(t => !t.isShiftable);
  const shiftableTasks = tasks.filter(t => t.isShiftable);

  // 1. Фонові прилади
  for (const task of fixedTasks) {
    const powerKw = task.powerWatts / 1000;
    for (let hour = 0; hour < 24; hour++) {
      schedule[hour]!.powerKw += powerKw;
      schedule[hour]!.devices.push(task.title);
    }
  }

  // 2. Переносні прилади
  shiftableTasks.sort((a, b) => b.powerWatts - a.powerWatts);

  const preferredHours = optimizeForEconomy 
    ? [1, 2, 3, 4, 5, 23, 10, 14, 15] 
    : [10, 12, 14, 16, 11, 13];

  for (const task of shiftableTasks) {
    const powerKw = task.powerWatts / 1000;
    const durationHours = Math.max(1, Math.ceil(task.durationMinutes / 60));

    let placed = false;

    for (const startHour of preferredHours) {
      let canFit = true;

      for (let h = startHour; h < startHour + durationHours; h++) {
        const targetHour = h % 24;
        if ((schedule[targetHour]?.powerKw ?? 0) + powerKw > maxPowerLimitKw) {
          canFit = false;
          break;
        }
      }

      if (canFit) {
        for (let h = startHour; h < startHour + durationHours; h++) {
          const targetHour = h % 24;
          schedule[targetHour]!.powerKw += powerKw;
          schedule[targetHour]!.devices.push(task.title);
        }
        placed = true;
        break;
      }
    }

    if (!placed) {
      let safestHour = 0;
      let minLoad = Infinity;

      for (let hour = 0; hour < 24; hour++) {
        if ((schedule[hour]?.powerKw ?? 0) < minLoad) {
          minLoad = schedule[hour]?.powerKw ?? 0;
          safestHour = hour;
        }
      }

      for (let h = safestHour; h < safestHour + durationHours; h++) {
        const targetHour = h % 24;
        schedule[targetHour]!.powerKw += powerKw;
        schedule[targetHour]!.devices.push(task.title);
      }
    }
  }

  return schedule.map((item, hour) => ({
    hour,
    totalPowerKw: Number(item.powerKw.toFixed(2)),
    activeDevices: Array.from(new Set(item.devices)),
  }));
}