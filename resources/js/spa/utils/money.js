const mmkFormatter = new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK',
    maximumFractionDigits: 0,
});

/**
 * @param {number|string|null|undefined} amount Integer kyat (or numeric string).
 * @returns {string}
 */
export function formatMMK(amount) {
    return mmkFormatter.format(toIntegerMMK(amount));
}

/**
 * @param {unknown} value
 * @returns {number} Non-negative integer kyat.
 */
export function toIntegerMMK(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
        return 0;
    }
    return Math.trunc(n);
}
