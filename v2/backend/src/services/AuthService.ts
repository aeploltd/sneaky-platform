export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export class AuthService {
  // Demo implementation - replace with real authentication
  
  async login(email: string, password: string) {
    // Demo: Accept any email/password combination
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }

    if (password.length < 4) {
      throw new Error('Password too short');
    }

    return {
      user: {
        id: 'demo-user-' + Date.now(),
        email,
        name: 'Demo User'
      },
      token: 'demo-token',
      expiresIn: '24h'
    };
  }

  async register(data: RegisterRequest) {
    // Demo: Accept any registration
    if (!data.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    if (data.password.length < 4) {
      throw new Error('Password too short');
    }

    return {
      user: {
        id: 'demo-user-' + Date.now(),
        email: data.email,
        name: data.name
      },
      token: 'demo-token',
      expiresIn: '24h'
    };
  }

  async validateToken(token: string) {
    // Demo: Only accept "demo-token"
    if (token === 'demo-token') {
      return {
        id: 'demo-user-id',
        email: 'demo@example.com',
        name: 'Demo User'
      };
    }
    
    throw new Error('Invalid token');
  }
}