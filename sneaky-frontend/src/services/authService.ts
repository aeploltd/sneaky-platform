import axios from 'axios';
import { User } from '@/types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class AuthService {
  private token: string | null = null;

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.setToken(null);
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async login(email: string, password: string) {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email,
      password,
    });
    return response.data;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName?: string;
  }) {
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, data);
    return response.data;
  }

  async logout() {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (error) {
      // Ignore errors during logout
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await axios.get(`${API_BASE_URL}/api/users/profile`);
    return response.data.user;
  }

  async updateProfile(data: Partial<User>) {
    const response = await axios.put(`${API_BASE_URL}/api/users/profile`, data);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await axios.put(`${API_BASE_URL}/api/users/password`, {
      currentPassword,
      newPassword,
    });
    return response.data;
  }
}

export const authService = new AuthService();