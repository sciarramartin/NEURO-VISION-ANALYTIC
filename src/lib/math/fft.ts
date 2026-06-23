interface Complex {
  re: number;
  im: number;
}

/**
 * Computes the Radix-2 Cooley-Tukey FFT recursively.
 * x.length MUST be a power of 2.
 */
function cooleyTukeyFFT(x: Complex[]): Complex[] {
  const n = x.length;
  if (n <= 1) return x;

  const even: Complex[] = [];
  const odd: Complex[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) even.push(x[i]);
    else odd.push(x[i]);
  }

  const tEven = cooleyTukeyFFT(even);
  const tOdd = cooleyTukeyFFT(odd);

  const y: Complex[] = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const angle = (-2 * Math.PI * k) / n;
    const twiddle: Complex = {
      re: Math.cos(angle),
      im: Math.sin(angle)
    };

    // tOdd[k] * twiddle
    const tOddTwiddled: Complex = {
      re: tOdd[k].re * twiddle.re - tOdd[k].im * twiddle.im,
      im: tOdd[k].re * twiddle.im + tOdd[k].im * twiddle.re
    };

    y[k] = {
      re: tEven[k].re + tOddTwiddled.re,
      im: tEven[k].im + tOddTwiddled.im
    };
    y[k + n / 2] = {
      re: tEven[k].re - tOddTwiddled.re,
      im: tEven[k].im - tOddTwiddled.im
    };
  }

  return y;
}

/**
 * Analyzes a recorded signal to find the dominant tremor frequency (Hz)
 * and its amplitude in the Parkinson's tremor band (3.0 - 8.0 Hz).
 * 
 * Detrends the input angles by subtracting the mean to eliminate 0 Hz DC offset.
 */
export function analyzeTremor(
  angles: number[],
  timestamps: number[], // time in seconds for each sample
  minFreq: number = 3.0,
  maxFreq: number = 8.0
): { dominantFrequency: number; amplitude: number; powerSpectrum: { freq: number; power: number }[] } {
  const n = angles.length;
  if (n < 4) {
    return { dominantFrequency: 0, amplitude: 0, powerSpectrum: [] };
  }

  // Calculate average sampling rate
  const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
  if (totalTime <= 0) {
    return { dominantFrequency: 0, amplitude: 0, powerSpectrum: [] };
  }
  const fs = n / totalTime;

  // Find next power of 2
  let nFft = 1;
  while (nFft < n) {
    nFft *= 2;
  }

  // Detrend (subtract the mean) to avoid huge 0Hz spikes
  const mean = angles.reduce((sum, val) => sum + val, 0) / n;
  const fftInput: Complex[] = [];
  for (let i = 0; i < nFft; i++) {
    if (i < n) {
      fftInput.push({ re: angles[i] - mean, im: 0 });
    } else {
      fftInput.push({ re: 0, im: 0 }); // Zero padding
    }
  }

  // Execute FFT
  const fftOutput = cooleyTukeyFFT(fftInput);

  // Calculate power spectrum (first half, positive frequencies)
  const powerSpectrum: { freq: number; power: number }[] = [];
  let maxPower = -1;
  let dominantFreq = 0;

  for (let k = 0; k < nFft / 2; k++) {
    const freq = (k * fs) / nFft;
    // Magnitude normalization (divided by N)
    const mag = Math.sqrt(fftOutput[k].re * fftOutput[k].re + fftOutput[k].im * fftOutput[k].im) / n;
    const power = mag * mag;

    powerSpectrum.push({ freq, power });

    // Identify dominant peak in the specified tremor band
    if (freq >= minFreq && freq <= maxFreq) {
      if (power > maxPower) {
        maxPower = power;
        dominantFreq = freq;
      }
    }
  }

  // Calculate amplitude in degrees (2 * sqrt(Power) for single-sided scale)
  const amplitude = maxPower > 0 ? Math.sqrt(maxPower) * 2 : 0;

  return {
    dominantFrequency: parseFloat(dominantFreq.toFixed(2)),
    amplitude: parseFloat(amplitude.toFixed(3)),
    powerSpectrum
  };
}
