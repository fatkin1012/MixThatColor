export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type LinearRgb = {
  r: number;
  g: number;
  b: number;
};

export type Lab = {
  l: number;
  a: number;
  b: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim().toLowerCase();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    throw new Error(`Expected a 3-digit or 6-digit hex color, received "${hex}".`);
  }

  const value = Number.parseInt(expanded, 16);

  if (Number.isNaN(value)) {
    throw new Error(`Could not parse hex color "${hex}".`);
  }

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

export function rgbToHex(rgb: Rgb): string {
  const componentToHex = (component: number) => {
    const safe = clamp(Math.round(component), 0, 255);
    return safe.toString(16).padStart(2, "0");
  };

  return `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`;
}

export function srgbChannelToLinear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function linearChannelToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1);
  const channel = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return clamp(channel * 255, 0, 255);
}

export function rgbToLinearRgb(rgb: Rgb): LinearRgb {
  return {
    r: srgbChannelToLinear(rgb.r),
    g: srgbChannelToLinear(rgb.g),
    b: srgbChannelToLinear(rgb.b),
  };
}

export function linearRgbToRgb(rgb: LinearRgb): Rgb {
  return {
    r: linearChannelToSrgb(rgb.r),
    g: linearChannelToSrgb(rgb.g),
    b: linearChannelToSrgb(rgb.b),
  };
}

export function rgbToLab(rgb: Rgb): Lab {
  const linear = rgbToLinearRgb(rgb);

  const x = linear.r * 0.4124564 + linear.g * 0.3575761 + linear.b * 0.1804375;
  const y = linear.r * 0.2126729 + linear.g * 0.7151522 + linear.b * 0.072175;
  const z = linear.r * 0.0193339 + linear.g * 0.119192 + linear.b * 0.9503041;

  const referenceX = 0.95047;
  const referenceY = 1;
  const referenceZ = 1.08883;
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  const transform = (value: number) => {
    if (value > epsilon) {
      return Math.cbrt(value);
    }

    return (kappa * value + 16) / 116;
  };

  const fx = transform(x / referenceX);
  const fy = transform(y / referenceY);
  const fz = transform(z / referenceZ);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labDistance(left: Lab, right: Lab): number {
  return Math.sqrt((left.l - right.l) ** 2 + (left.a - right.a) ** 2 + (left.b - right.b) ** 2);
}

export function blendLinearRgb(colors: Array<{ rgb: LinearRgb; weight: number }>): LinearRgb {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  const totals = colors.reduce(
    (accumulator, item) => {
      accumulator.r += item.rgb.r * item.weight;
      accumulator.g += item.rgb.g * item.weight;
      accumulator.b += item.rgb.b * item.weight;
      accumulator.weight += item.weight;
      return accumulator;
    },
    { r: 0, g: 0, b: 0, weight: 0 },
  );

  if (totals.weight === 0) {
    return colors[0]?.rgb ?? { r: 0, g: 0, b: 0 };
  }

  return {
    r: totals.r / totals.weight,
    g: totals.g / totals.weight,
    b: totals.b / totals.weight,
  };
}