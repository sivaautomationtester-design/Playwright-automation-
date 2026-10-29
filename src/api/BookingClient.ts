import { APIRequestContext, APIResponse } from '@playwright/test';
import { Booking } from './types';

/**
 * Thin client for the Restful-Booker API.
 * Methods return the raw APIResponse so tests can assert on status codes, headers and bodies,
 * including the error cases.
 */
export class BookingClient {
  constructor(private readonly request: APIRequestContext) {}

  ping(): Promise<APIResponse> {
    return this.request.get('/ping');
  }

  createToken(username: string, password: string): Promise<APIResponse> {
    return this.request.post('/auth', { data: { username, password } });
  }

  createBooking(booking: Partial<Booking> | Record<string, unknown>): Promise<APIResponse> {
    return this.request.post('/booking', { data: booking });
  }

  getBooking(id: number): Promise<APIResponse> {
    return this.request.get(`/booking/${id}`);
  }

  searchBookings(params: { firstname?: string; lastname?: string } = {}): Promise<APIResponse> {
    return this.request.get('/booking', { params });
  }

  updateBooking(id: number, booking: Booking, token?: string): Promise<APIResponse> {
    return this.request.put(`/booking/${id}`, { data: booking, headers: this.auth(token) });
  }

  patchBooking(id: number, changes: Partial<Booking>, token?: string): Promise<APIResponse> {
    return this.request.patch(`/booking/${id}`, { data: changes, headers: this.auth(token) });
  }

  deleteBooking(id: number, token?: string): Promise<APIResponse> {
    return this.request.delete(`/booking/${id}`, { headers: this.auth(token) });
  }

  // Restful-Booker reads the auth token from a cookie.
  private auth(token?: string): Record<string, string> {
    return token ? { Cookie: `token=${token}` } : {};
  }
}
