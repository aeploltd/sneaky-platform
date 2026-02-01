// Common types for the application

export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Server {
  id: string;
  name: string;
  type: string;
  region: string;
  status: 'pending' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  updatedAt: Date;
}