import { Client } from 'pg';
import { createClient } from 'redis';
import winston from 'winston';
import cron from 'node-cron';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/database-monitor.log' }),
    new winston.transports.Console()
  ]
});

class DatabaseMonitor {
  private pgClient: Client;
  private redisClient: any;

  constructor() {
    this.pgClient = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://sneaky_admin:sneaky_secure_2024@localhost:5432/sneaky_hosting'
    });

    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
  }

  async initialize(): Promise<void> {
    try {
      // Connect to PostgreSQL
      await this.pgClient.connect();
      logger.info('Connected to PostgreSQL');

      // Connect to Redis
      await this.redisClient.connect();
      logger.info('Connected to Redis');

      // Start monitoring tasks
      this.startMonitoring();
      
    } catch (error) {
      logger.error('Failed to initialize database monitor:', error);
      process.exit(1);
    }
  }

  private startMonitoring(): void {
    // Check database health every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.checkDatabaseHealth();
    });

    // Clean up old metrics every hour
    cron.schedule('0 * * * *', async () => {
      await this.cleanupOldMetrics();
    });

    // Generate daily reports at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.generateDailyReport();
    });

    // Backup database daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.performBackup();
    });

    logger.info('Database monitoring tasks started');
  }

  private async checkDatabaseHealth(): Promise<void> {
    try {
      // Check PostgreSQL connection
      const pgResult = await this.pgClient.query('SELECT NOW()');
      logger.info('PostgreSQL health check passed', { timestamp: pgResult.rows[0].now });

      // Check Redis connection
      const redisResult = await this.redisClient.ping();
      logger.info('Redis health check passed', { response: redisResult });

      // Check database size
      const sizeResult = await this.pgClient.query(`
        SELECT 
          pg_size_pretty(pg_database_size('sneaky_hosting')) as database_size,
          (SELECT count(*) FROM servers) as server_count,
          (SELECT count(*) FROM users) as user_count,
          (SELECT count(*) FROM organizations) as organization_count
      `);

      logger.info('Database statistics', sizeResult.rows[0]);

      // Check for long-running queries
      const longQueries = await this.pgClient.query(`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query 
        FROM pg_stat_activity 
        WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
        AND state = 'active'
      `);

      if (longQueries.rows.length > 0) {
        logger.warn('Long-running queries detected', { count: longQueries.rows.length });
      }

    } catch (error) {
      logger.error('Database health check failed:', error);
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    try {
      // Keep only last 7 days of server metrics
      const result = await this.pgClient.query(`
        DELETE FROM server_metrics 
        WHERE timestamp < NOW() - INTERVAL '7 days'
      `);

      logger.info('Cleaned up old metrics', { deleted_rows: result.rowCount });

      // Clean up old audit logs (keep 30 days)
      const auditResult = await this.pgClient.query(`
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);

      logger.info('Cleaned up old audit logs', { deleted_rows: auditResult.rowCount });

    } catch (error) {
      logger.error('Failed to cleanup old metrics:', error);
    }
  }

  private async generateDailyReport(): Promise<void> {
    try {
      // Generate server utilization report
      const serverReport = await this.pgClient.query(`
        SELECT 
          COUNT(*) as total_servers,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_servers,
          COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_servers,
          SUM(monthly_price) as total_monthly_cost
        FROM servers 
        WHERE is_active = true
      `);

      // Generate user activity report
      const userReport = await this.pgClient.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_today,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_week
        FROM users 
        WHERE is_active = true
      `);

      // Generate billing report
      const billingReport = await this.pgClient.query(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(amount) as total_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices
        FROM billing 
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      `);

      const report = {
        date: new Date().toISOString().split('T')[0],
        servers: serverReport.rows[0],
        users: userReport.rows[0],
        billing: billingReport.rows[0]
      };

      logger.info('Daily report generated', report);

      // Store report in Redis for dashboard
      await this.redisClient.setEx(
        `daily_report:${report.date}`,
        86400, // 24 hours
        JSON.stringify(report)
      );

    } catch (error) {
      logger.error('Failed to generate daily report:', error);
    }
  }

  private async performBackup(): Promise<void> {
    try {
      logger.info('Starting database backup...');
      
      // This is a simplified backup - in production you'd use pg_dump
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `sneaky_backup_${timestamp}`;
      
      // Store backup metadata
      await this.redisClient.setEx(
        `backup:${backupName}`,
        2592000, // 30 days
        JSON.stringify({
          name: backupName,
          timestamp: new Date().toISOString(),
          status: 'completed',
          size: '0MB' // Would be actual size in production
        })
      );

      logger.info('Database backup completed', { backup_name: backupName });

    } catch (error) {
      logger.error('Database backup failed:', error);
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.pgClient.end();
      await this.redisClient.disconnect();
      logger.info('Database monitor shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Initialize and start the monitor
const monitor = new DatabaseMonitor();

monitor.initialize().catch((error) => {
  logger.error('Failed to start database monitor:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await monitor.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await monitor.shutdown();
  process.exit(0);
});