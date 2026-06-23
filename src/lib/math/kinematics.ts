/**
 * Calculates velocities (degrees per second) from an angle timeseries.
 */
export function calcularVelocidades(data: { tiempo: number; angulo: number }[]): number[] {
  if (data.length < 2) return [];
  const velocities: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const dt = data[i].tiempo - data[i - 1].tiempo;
    const dAngle = data[i].angulo - data[i - 1].angulo;
    if (dt > 0) {
      velocities.push(Math.abs(dAngle / dt));
    } else {
      velocities.push(0);
    }
  }
  return velocities;
}

/**
 * Calculates Left vs Right range-of-motion asymmetry percentage index.
 * 0% means perfect symmetry, higher values indicate greater asymmetry.
 */
export function calcularAsimetria(leftRom: number, rightRom: number): number {
  const sum = leftRom + rightRom;
  if (sum === 0) return 0;
  return (Math.abs(leftRom - rightRom) / sum) * 100;
}

/**
 * Applies a simple rolling moving average filter to smooth raw tracking signals.
 */
export function smoothSignal(values: number[], windowSize: number = 3): number[] {
  if (values.length === 0) return [];
  const smoothed: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let w = -halfWindow; w <= halfWindow; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < values.length) {
        sum += values[idx];
        count++;
      }
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}
