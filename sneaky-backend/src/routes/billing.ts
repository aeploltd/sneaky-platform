import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { AuthenticatedRequest, requireOrganization } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/billing:
 *   get:
 *     summary: Get billing history for organization
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing history
 */
router.get('/', [requireOrganization], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    prisma.billing.findMany({
      where: {
        organizationId: req.user!.organizationId
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.billing.count({
      where: {
        organizationId: req.user!.organizationId
      }
    })
  ]);

  // Calculate summary statistics
  const summary = await prisma.billing.aggregate({
    where: {
      organizationId: req.user!.organizationId
    },
    _sum: {
      amount: true
    },
    _count: {
      id: true
    }
  });

  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const monthlyTotal = await prisma.billing.aggregate({
    where: {
      organizationId: req.user!.organizationId,
      createdAt: {
        gte: currentMonth
      }
    },
    _sum: {
      amount: true
    }
  });

  res.json({
    invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    summary: {
      totalAmount: summary._sum.amount || 0,
      totalInvoices: summary._count.id,
      monthlyTotal: monthlyTotal._sum.amount || 0
    }
  });
}));

/**
 * @swagger
 * /api/billing/usage:
 *   get:
 *     summary: Get current usage and costs
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current usage statistics
 */
router.get('/usage', [requireOrganization], asyncHandler(async (req: AuthenticatedRequest, res) => {
  // Get current servers and their costs
  const servers = await prisma.server.findMany({
    where: {
      organizationId: req.user!.organizationId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      provider: true,
      instanceType: true,
      monthlyPrice: true,
      status: true,
      createdAt: true
    }
  });

  // Calculate prorated costs for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();

  let totalMonthlyCost = 0;
  let currentUsage = 0;

  const serverUsage = servers.map(server => {
    const monthlyPrice = parseFloat(server.monthlyPrice.toString());
    totalMonthlyCost += monthlyPrice;

    // Calculate prorated cost based on when server was created
    const serverStartDate = server.createdAt > startOfMonth ? server.createdAt : startOfMonth;
    const daysUsed = Math.ceil((now.getTime() - serverStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const proratedCost = (monthlyPrice / daysInMonth) * Math.min(daysUsed, daysPassed);
    
    currentUsage += proratedCost;

    return {
      ...server,
      monthlyPrice: monthlyPrice,
      currentCost: proratedCost
    };
  });

  // Get domain count
  const domainCount = await prisma.domain.count({
    where: {
      organizationId: req.user!.organizationId
    }
  });

  // Get deployment count
  const deploymentCount = await prisma.deployment.count({
    where: {
      organizationId: req.user!.organizationId
    }
  });

  res.json({
    usage: {
      servers: serverUsage,
      totalServers: servers.length,
      totalDomains: domainCount,
      totalDeployments: deploymentCount,
      estimatedMonthlyCost: totalMonthlyCost,
      currentMonthUsage: currentUsage,
      projectedMonthlyCost: (currentUsage / daysPassed) * daysInMonth
    }
  });
}));

export default router;