function round(amount, decimalDigits) {
  const factor = 10 ** decimalDigits;
  return Math.round(amount * factor) / factor;
}

export { round };
