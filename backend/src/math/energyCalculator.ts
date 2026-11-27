/**
 * Розрахунок спожитої енергії в кВт·год
 * Формула: (Потужність Вт / 1000) * (Тривалість хвилини / 60)
 */
export function calculateEnergyKWh(powerWatts: number, durationMinutes: number): number {
  if (powerWatts <= 0 || durationMinutes <= 0) return 0;
  const energy = (powerWatts / 1000) * (durationMinutes / 60);
  return Number(energy.toFixed(4)); // Округлюємо до 4 знаків після коми
}

/**
 * Розрахунок часу роботи пристроїв від альтернативного джерела (EcoFlow / Bluetti / акумулятор)
 * @param batteryCapacityWh Ємність акумулятора у Вт·год (Wh)
 * @param activeDevicesPowerWatts Сумарна потужність активних приладів у Вт
 */
export function calculateBatteryRuntime(
  batteryCapacityWh: number,
  activeDevicesPowerWatts: number
): { hours: number; minutes: number } {
  if (activeDevicesPowerWatts <= 0) {
    return { hours: 999, minutes: 59 }; // Якщо немає навантаження
  }

  const totalHours = batteryCapacityWh / activeDevicesPowerWatts;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  return { hours, minutes };
}