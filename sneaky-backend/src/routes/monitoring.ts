import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { AuthenticatedRequest, requireOrganization } from '@/middleware/auth';
import { ServerService } from '@/services/ServerService';

const router = Router();

/**
 * @swagger
 * /api/monitoring/overview:
 *   get:
 *     summary: Get monitoring overview for organization
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring overview
 */
router.get('/overview', [requireOrganization], asyncHandler(async (req: AuthenticatedRequest, res) => {
  // Get server status summary
  const serverStats = await prisma.server.groupBy({
    by: ['status'],
    where: {
      organizationId: req.user!.organizationId,
      isActive: true
    },
    _count: {
      id: true
    }
  });

  // Get recent alerts (simulated - in production this would come from a monitoring system)
  const recentMetrics = await prisma.serverMetric.findMany({
    where: {
      server: {
        organizationId: req.user!.organizationId
      },
      timestamp: {
        gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      }
    },
    include: {
      server: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 100
  });

  // Identify servers with high resource usage
  const alerts = recentMetrics
    .filter(metric => 
      parseFloat(metric.cpuUsage.toString()) > 80 || 
      parseFloat(metric.memoryUsage.toString()) > 85 ||
      parseFloat(metric.diskUsage.toString()) > 90
    )
    .slice(0, 10)
    .map(metric => ({
      id: `alert-${metric.id}`,
      serverId: metric.serverId,
      serverName: metric.server.name,
      type: parseFloat(metric.cpuUsage.toString()) > 80 ? 'cpu' : 
            parseFloat(metric.memoryUsage.toString()) > 85 ? 'memory' : 'disk',
      value: parseFloat(metric.cpuUsage.toString()) > 80 ? metric.cpuUsage :
             parseFloat(metric.memoryUsage.toString()) > 85 ? metric.memoryUsage : metric.diskUsage,
      timestamp: metric.timestamp,
      severity: 'warning'
    }));

  // Calculate average resource usage
  const avgMetrics = recentMetrics.reduce((acc, metric) => {
    acc.cpu += parseFloat(metric.cpuUsage.toString());
    acc.memory += parseFloat(metric.memoryUsage.toString());
    acc.disk += parseFloat(metric.diskUsage.toString());
    acc.count++;
    return acc;
  }, { cpu: 0, memory: 0, disk: 0, count: 0 });

  const averageUsage = avgMetrics.count > 0 ? {
    cpu: avgMetrics.cpu / avgMetrics.count,
    memory: avgMetrics.memory / avgMetrics.count,
    disk: avgMetrics.disk / avgMetrics.count
  } : { cpu: 0, memory: 0, disk: 0 };

  res.json({
    overview: {
      serverStats: serverStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      averageUsage,
      alerts,
      totalServers: serverStats.reduce((sum, stat) => sum + stat._count.id, 0),
      activeAlerts: alerts.length
    }
  });
}));

/**
 * @swagger
 * /api/monitoring/servers/{id}/metrics:
 *   get:
 *     summary: Get metrics for a specific server
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *     responses:
 *       200:
 *         description: Server metrics
 */
router.get('/servers/:id/metrics', [
  requireOrganization,
  query('hours').optional().isInt({ min: 1, max: 168 }) // Max 1 week
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const serverId = req.params.id;
  const hours = parseInt(req.query.hours as string) || 24;

  // Verify server belongs to organization
  const server = await prisma.server.findFirst({
    where: {
      id: serverId,
      organizationId: req.user!.organizationId,
      isActive: true
    }
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  const metrics = await ServerService.getServerMetrics(serverId, hours);

  // Group metrics by time intervals for better visualization
  const interval = hours <= 24 ? 5 : hours <= 168 ? 60 : 360; // 5min, 1hr, or 6hr intervals
  const groupedMetrics = metrics.reduce((acc, metric) => {
    const timestamp = new Date(metric.timestamp);
    const intervalStart = new Date(Math.floor(timestamp.getTime() / (interval * 60 * 1000)) * interval * 60 * 1000);
    const key = intervalStart.toISOString();

    if (!acc[key]) {
      acc[key] = {
        timestamp: intervalStart,
        cpu: [],
        memory: [],
        disk: [],
        networkIn: [],
        networkOut: []
      };
    }

    acc[key].cpu.push(parseFloat(metric.cpuUsage.toString()));
    acc[key].memory.push(parseFloat(metric.memoryUsage.toString()));
    acc[key].disk.push(parseFloat(metric.diskUsage.toString()));
    acc[key].networkIn.push(parseFloat(metric.networkIn.toString()));
    acc[key].networkOut.push(parseFloat(metric.networkOut.toString()));

    return acc;
  }, {} as any);

  // Calculate averages for each interval
  const processedMetrics = Object.values(groupedMetrics).map((group: any) => ({
    timestamp: group.timestamp,
    cpuUsage: group.cpu.reduce((a: number, b: number) => a + b, 0) / group.cpu.length,
    memoryUsage: group.memory.reduce((a: number, b: number) => a + b, 0) / group.memory.length,
    diskUsage: group.disk.reduce((a: number, b: number) => a + b, 0) / group.disk.length,
    networkIn: group.networkIn.reduce((a: number, b: number) => a + b, 0) / group.networkIn.length,
    networkOut: group.networkOut.reduce((a: number, b: number) => a + b, 0) / group.networkOut.length
  })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  res.json({
    server: {
      id: server.id,
      name: server.name,
      status: server.status
    },
    metrics: processedMetrics,
    summary: {
      dataPoints: processedMetrics.length,
      timeRange: `${hours} hours`,
      interval: `${interval} minutes`
    }
  });
}));

export default router;