import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';

interface InstanceSpecs {
  cpu: number;
  memory: number;
  storage: number;
  bandwidth: number;
  monthlyPrice: number;
}

export class ServerService {
  private static instanceSpecs: Record<string, Record<string, InstanceSpecs>> = {
    aws: {
      't3.micro': { cpu: 2, memory: 1, storage: 20, bandwidth: 100, monthlyPrice: 8.50 },
      't3.small': { cpu: 2, memory: 2, storage: 20, bandwidth: 100, monthlyPrice: 17.00 },
      't3.medium': { cpu: 2, memory: 4, storage: 30, bandwidth: 200, monthlyPrice: 34.00 },
      't3.large': { cpu: 2, memory: 8, storage: 50, bandwidth: 300, monthlyPrice: 68.00 },
      'm5.large': { cpu: 2, memory: 8, storage: 50, bandwidth: 500, monthlyPrice: 88.00 },
      'm5.xlarge': { cpu: 4, memory: 16, storage: 100, bandwidth: 750, monthlyPrice: 176.00 }
    },
    digitalocean: {
      's-1vcpu-1gb': { cpu: 1, memory: 1, storage: 25, bandwidth: 1000, monthlyPrice: 6.00 },
      's-1vcpu-2gb': { cpu: 1, memory: 2, storage: 50, bandwidth: 2000, monthlyPrice: 12.00 },
      's-2vcpu-2gb': { cpu: 2, memory: 2, storage: 60, bandwidth: 3000, monthlyPrice: 18.00 },
      's-2vcpu-4gb': { cpu: 2, memory: 4, storage: 80, bandwidth: 4000, monthlyPrice: 24.00 },
      's-4vcpu-8gb': { cpu: 4, memory: 8, storage: 160, bandwidth: 5000, monthlyPrice: 48.00 }
    },
    gcp: {
      'e2-micro': { cpu: 2, memory: 1, storage: 20, bandwidth: 100, monthlyPrice: 7.00 },
      'e2-small': { cpu: 2, memory: 2, storage: 20, bandwidth: 200, monthlyPrice: 14.00 },
      'e2-medium': { cpu: 2, memory: 4, storage: 30, bandwidth: 300, monthlyPrice: 28.00 },
      'e2-standard-2': { cpu: 2, memory: 8, storage: 50, bandwidth: 500, monthlyPrice: 56.00 },
      'e2-standard-4': { cpu: 4, memory: 16, storage: 100, bandwidth: 750, monthlyPrice: 112.00 }
    },
    azure: {
      'B1s': { cpu: 1, memory: 1, storage: 30, bandwidth: 100, monthlyPrice: 8.00 },
      'B1ms': { cpu: 1, memory: 2, storage: 30, bandwidth: 200, monthlyPrice: 16.00 },
      'B2s': { cpu: 2, memory: 4, storage: 60, bandwidth: 400, monthlyPrice: 32.00 },
      'B2ms': { cpu: 2, memory: 8, storage: 60, bandwidth: 600, monthlyPrice: 64.00 },
      'B4ms': { cpu: 4, memory: 16, storage: 120, bandwidth: 1000, monthlyPrice: 128.00 }
    }
  };

  static async getInstanceSpecs(provider: string, instanceType: string): Promise<InstanceSpecs> {
    const specs = this.instanceSpecs[provider]?.[instanceType];
    if (!specs) {
      throw new Error(`Unknown instance type: ${provider}/${instanceType}`);
    }
    return specs;
  }

  static async provisionServer(serverId: string): Promise<void> {
    try {
      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        throw new Error('Server not found');
      }

      logger.info(`Starting provisioning for server ${serverId}`);

      // Update status to provisioning
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'pending' }
      });

      // Simulate provisioning process
      setTimeout(async () => {
        try {
          // Generate a mock IP address
          const ipAddress = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

          await prisma.server.update({
            where: { id: serverId },
            data: {
              status: 'running',
              ipAddress
            }
          });

          logger.info(`Server ${serverId} provisioned successfully with IP ${ipAddress}`);

          // Start metrics collection
          this.startMetricsCollection(serverId);

          // Emit socket event
          const io = (global as any).io;
          if (io) {
            io.to(`server:${serverId}`).emit('server:status', {
              serverId,
              status: 'running',
              ipAddress
            });
          }
        } catch (error) {
          logger.error(`Failed to provision server ${serverId}:`, error);
          await prisma.server.update({
            where: { id: serverId },
            data: { status: 'failed' }
          });
        }
      }, 30000); // 30 seconds simulation

    } catch (error) {
      logger.error(`Provisioning failed for server ${serverId}:`, error);
      throw error;
    }
  }

  static async startServer(serverId: string): Promise<void> {
    try {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'running' }
      });

      this.startMetricsCollection(serverId);

      logger.info(`Server ${serverId} started`);

      // Emit socket event
      const io = (global as any).io;
      if (io) {
        io.to(`server:${serverId}`).emit('server:status', {
          serverId,
          status: 'running'
        });
      }
    } catch (error) {
      logger.error(`Failed to start server ${serverId}:`, error);
      throw error;
    }
  }

  static async stopServer(serverId: string): Promise<void> {
    try {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'stopped' }
      });

      this.stopMetricsCollection(serverId);

      logger.info(`Server ${serverId} stopped`);

      // Emit socket event
      const io = (global as any).io;
      if (io) {
        io.to(`server:${serverId}`).emit('server:status', {
          serverId,
          status: 'stopped'
        });
      }
    } catch (error) {
      logger.error(`Failed to stop server ${serverId}:`, error);
      throw error;
    }
  }

  private static metricsIntervals: Map<string, NodeJS.Timeout> = new Map();

  static startMetricsCollection(serverId: string): void {
    // Clear existing interval if any
    this.stopMetricsCollection(serverId);

    const interval = setInterval(async () => {
      try {
        // Generate realistic metrics
        const cpuUsage = Math.random() * 100;
        const memoryUsage = Math.random() * 100;
        const diskUsage = Math.random() * 100;
        const networkIn = Math.random() * 1000000; // bytes
        const networkOut = Math.random() * 1000000; // bytes

        await prisma.serverMetric.create({
          data: {
            serverId,
            cpuUsage,
            memoryUsage,
            diskUsage,
            networkIn,
            networkOut
          }
        });

        // Emit real-time metrics
        const io = (global as any).io;
        if (io) {
          io.to(`server:${serverId}`).emit('server:metrics', {
            serverId,
            metrics: {
              cpuUsage,
              memoryUsage,
              diskUsage,
              networkIn,
              networkOut,
              timestamp: new Date()
            }
          });
        }

        // Clean up old metrics (keep last 1000 records)
        const oldMetrics = await prisma.serverMetric.findMany({
          where: { serverId },
          orderBy: { timestamp: 'desc' },
          skip: 1000
        });

        if (oldMetrics.length > 0) {
          await prisma.serverMetric.deleteMany({
            where: {
              id: { in: oldMetrics.map(m => m.id) }
            }
          });
        }

      } catch (error) {
        logger.error(`Failed to collect metrics for server ${serverId}:`, error);
      }
    }, config.monitoring.metricsInterval);

    this.metricsIntervals.set(serverId, interval);
  }

  static stopMetricsCollection(serverId: string): void {
    const interval = this.metricsIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.metricsIntervals.delete(serverId);
    }
  }

  static async getServerMetrics(serverId: string, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await prisma.serverMetric.findMany({
      where: {
        serverId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' }
    });
  }
}