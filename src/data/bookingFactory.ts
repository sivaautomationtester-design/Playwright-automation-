import { Booking } from '../api/types';

const FIRST_NAMES = ['Asha', 'Ravi', 'Meera', 'Arjun', 'Kavya', 'Vikram', 'Divya', 'Karthik'];
const LAST_NAMES = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Menon', 'Patel', 'Rao'];
const NEEDS = ['Breakfast', 'Late checkout', 'Airport pickup', 'Extra pillows'];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const randomInt = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));
const randomLetters = (n: number): string =>
  Array.from({ length: n }, () => String.fromCharCode(97 + randomInt(0, 25))).join('');

export const isoDate = (daysFromToday: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

/**
 * Builds a valid, unique booking. Names get a random suffix so every run (and every parallel
 * worker) works on its own data. Pass overrides to control specific fields.
 */
export function buildBooking(overrides: Partial<Booking> = {}): Booking {
  const start = randomInt(7, 60);
  return {
    firstname: pick(FIRST_NAMES) + randomLetters(5),
    lastname: pick(LAST_NAMES) + randomLetters(5),
    totalprice: randomInt(50, 500),
    depositpaid: Math.random() < 0.5,
    bookingdates: { checkin: isoDate(start), checkout: isoDate(start + randomInt(1, 7)) },
    additionalneeds: pick(NEEDS),
    ...overrides,
  };
}
