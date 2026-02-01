export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface CreateUserRequest {
  email: string;
  name: string;
}

export class UserService {
  // Demo data store - replace with real database
  private users: User[] = [
    {
      id: 'demo-user-id',
      email: 'demo@example.com',
      name: 'Demo User',
      createdAt: new Date()
    },
    {
      id: 'user-2',
      email: 'john@example.com',
      name: 'John Doe',
      createdAt: new Date()
    }
  ];

  async getProfile(userId: string): Promise<User | null> {
    return this.users.find(user => user.id === userId) || null;
  }

  async getUsers(): Promise<User[]> {
    return this.users;
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const user: User = {
      id: 'user-' + Date.now(),
      email: data.email,
      name: data.name,
      createdAt: new Date()
    };

    this.users.push(user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const userIndex = this.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return null;
    }

    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    return this.users[userIndex];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const userIndex = this.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return false;
    }

    this.users.splice(userIndex, 1);
    return true;
  }
}