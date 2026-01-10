type NormalizedPhone = {
  digits: string;
  formatted: string;
  e164: string;
};

function formatUsPhoneDigits(digits: string) {
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 10);

  if (digits.length <= 3) {
    return part1;
  }
  if (digits.length <= 6) {
    return `${part1}-${part2}`;
  }
  return `${part1}-${part2}-${part3}`;
}

function normalizeUsPhone(input: string): NormalizedPhone | null {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  if (normalized.length !== 10) {
    return null;
  }

  const formatted = formatUsPhoneDigits(normalized);
  return { digits: normalized, formatted, e164: `+1${normalized}` };
}

function isValidUsPhone(input: string) {
  return normalizeUsPhone(input) !== null;
}

export { isValidUsPhone, normalizeUsPhone };
export type { NormalizedPhone };
export { formatUsPhoneDigits };
