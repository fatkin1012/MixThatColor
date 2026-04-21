import { blendLinearRgb, hexToRgb, labDistance, linearRgbToRgb, rgbToHex, rgbToLab, rgbToLinearRgb } from "./color";

export interface Dye {
  id: string;
  name: string;
  hex: string;
}

export interface MixResult {
  drops: number[];
  totalDrops: number;
  mixedHex: string;
  distance: number;
}

export function solveMix(targetHex: string, dyes: Dye[], totalDrops: number): MixResult | null {
  if (dyes.length === 0 || totalDrops <= 0) {
    return null;
  }

  const targetLab = rgbToLab(hexToRgb(targetHex));
  const linearDyes = dyes.map((dye) => ({
    dye,
    rgb: rgbToLinearRgb(hexToRgb(dye.hex)),
  }));

  const counts = new Array(dyes.length).fill(0);
  let best: MixResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const evaluate = () => {
    const mixedLinear = blendLinearRgb(
      linearDyes.map((item, index) => ({ rgb: item.rgb, weight: counts[index] / totalDrops })),
    );
    const mixedHex = rgbToHex(linearRgbToRgb(mixedLinear));
    const distance = labDistance(targetLab, rgbToLab(hexToRgb(mixedHex)));

    if (distance < bestScore) {
      bestScore = distance;
      best = {
        drops: [...counts],
        totalDrops,
        mixedHex,
        distance,
      };
    }
  };

  const search = (index: number, remaining: number) => {
    if (index === dyes.length - 1) {
      counts[index] = remaining;
      evaluate();
      return;
    }

    for (let drops = 0; drops <= remaining; drops += 1) {
      counts[index] = drops;
      search(index + 1, remaining - drops);
    }
  };

  search(0, totalDrops);
  return best;
}