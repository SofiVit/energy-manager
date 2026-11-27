export type TariffType = 'single' | 'dual' | 'triple';

interface TariffCalculationInput {
  energyKWh: number;
  tariffType: TariffType;
  baseRateUah: number; // Базова вартість за 1 кВт·год (наприклад, 4.32 грн)
  hourOfDay?: number;  // Година доби (0 - 23) для багатозонних тарифів
}

/**
 * Розрахунок вартості електроенергії з урахуванням тарифних зон
 */
export function calculateElectricityCost(input: TariffCalculationInput): number {
  const { energyKWh, tariffType, baseRateUah, hourOfDay = 12 } = input;

  if (energyKWh <= 0 || baseRateUah <= 0) return 0;

  let coefficient = 1.0;

  if (tariffType === 'dual') {
    // Двозонний: нічний час з 23:00 до 07:00 — знижка 50% (коефіцієнт 0.5)
    if (hourOfDay >= 23 || hourOfDay < 7) {
      coefficient = 0.5;
    }
  } else if (tariffType === 'triple') {
    // Тризонний тариф:
    // Нічний період (23:00 – 07:00): коефіцієнт 0.4 (знижка 60%)
    if (hourOfDay >= 23 || hourOfDay < 7) {
      coefficient = 0.4;
    } 
    // Піковий період (08:00–11:00, 20:00–22:00): коефіцієнт 1.5 (націнка 50%)
    else if (
      (hourOfDay >= 8 && hourOfDay < 11) || 
      (hourOfDay >= 20 && hourOfDay < 22)
    ) {
      coefficient = 1.5;
    }
    // Напівпіковий період: решта годин — коефіцієнт 1.0
    else {
      coefficient = 1.0;
    }
  }
  // Для 'single' (звичайний тариф) коефіцієнт залишається 1.0 цілодобово

  const cost = energyKWh * baseRateUah * coefficient;
  return Number(cost.toFixed(2)); // Округлюємо до копійок
}