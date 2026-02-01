export interface Server {
  id: string;
  name: string;
  type: string;
  region: string;
  status: 'pending' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServerRequest {
  name: string;
  type: string;
  region: string;
  status: string;
}

export class ServerService {
  // Demo data store - replace with real database
  private servers: Server[] = [
    {
      id: 'server-1',
      name: 'Web Server 1',
      type: 'web',
      region: 'us-east-1',
      status: 'running',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'server-2',
      name: 'Database Server',
      type: 'database',
      region: 'us-west-2',
      status: 'running',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date()
    },
    {
      id: 'server-3',
      name: 'API Server',
      type: 'api',
      region: 'eu-west-1',
      status: 'stopped',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date()
    }
  ];

  async getServers(): Promise<Server[]> {
    return this.servers;
  }

  async getServer(serverId: string): Promise<Server | null> {
    return this.servers.find(server => server.id === serverId) || null;
  }

  async createServer(data: CreateServerRequest): Promise<Server> {
    const server: Server = {
      id: 'server-' + Date.now(),
      name: data.name,
      type: data.type,
      region: data.region,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.servers.push(server);
    
    // Simulate server provisioning
    setTimeout(() => {
      server.status = 'running';
      server.updatedAt = new Date();
    }, 2000);

    return server;
  }

  async updateServer(serverId: string, updates: Partial<Server>): Promise<Server | null> {
    const serverIndex = this.servers.findIndex(server => server.id === serverId);
    
    if (serverIndex === -1) {
      return null;
    }

    this.servers[serverIndex] = { 
      ...this.servers[serverIndex], 
      ...updates,
      updatedAt: new Date()
    };
    
    return this.servers[serverIndex];
  }

  async deleteServer(serverId: string): Promise<boolean> {
    const serverIndex = this.servers.findIndex(server => server.id === serverId);
    
    if (serverIndex === -1) {
      return false;
    }

    this.servers.splice(serverIndex, 1);
    return true;
  }

  async getServersByStatus(status: string): Promise<Server[]> {
    return this.servers.filter(server => server.status === status);
  }

  async getServersByRegion(region: string): Promise<Server[]> {
    return this.servers.filter(server => server.region === region);
  }
}