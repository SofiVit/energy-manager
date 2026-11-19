// backend/src/utils/mappers.ts

export const mapPriorityToNumber = (priority: string): number => {
  switch (priority.toLowerCase()) {
    case 'low': return 1;
    case 'medium': return 3;
    case 'high': return 5;
    default: return 3; 
  }
};

export const mapNumberToPriority = (priorityNum: number): string => {
  if (priorityNum <= 2) return 'low';
  if (priorityNum >= 4) return 'high';
  return 'medium'; 
};