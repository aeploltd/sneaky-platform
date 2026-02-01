-- Initialize Sneaky Hosting Database
-- This script runs when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sneaky_admin') THEN
        CREATE ROLE sneaky_admin WITH LOGIN PASSWORD 'sneaky_secure_2024';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sneaky_hosting TO sneaky_admin;
GRANT ALL ON SCHEMA public TO sneaky_admin;

-- Create indexes for better performance (will be created by Prisma migrations)
-- These are just examples of what we might need

-- Performance monitoring views
CREATE OR REPLACE VIEW server_performance_summary AS
SELECT 
    s.id,
    s.name,
    s.status,
    AVG(sm.cpu_usage) as avg_cpu,
    AVG(sm.memory_usage) as avg_memory,
    AVG(sm.disk_usage) as avg_disk,
    COUNT(sm.id) as metric_count,
    MAX(sm.timestamp) as last_metric
FROM servers s
LEFT JOIN server_metrics sm ON s.id = sm.server_id
WHERE sm.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY s.id, s.name, s.status;

-- Billing summary view
CREATE OR REPLACE VIEW monthly_billing_summary AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    DATE_TRUNC('month', b.created_at) as billing_month,
    SUM(b.amount) as total_amount,
    COUNT(b.id) as invoice_count,
    COUNT(CASE WHEN b.status = 'paid' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN b.status = 'overdue' THEN 1 END) as overdue_invoices
FROM organizations o
LEFT JOIN billing b ON o.id = b.organization_id
GROUP BY o.id, o.name, DATE_TRUNC('month', b.created_at)
ORDER BY billing_month DESC;

-- Server utilization view
CREATE OR REPLACE VIEW server_utilization AS
SELECT 
    s.id,
    s.name,
    s.provider,
    s.instance_type,
    s.monthly_price,
    COUNT(d.id) as deployment_count,
    COUNT(dom.id) as domain_count,
    CASE 
        WHEN COUNT(d.id) = 0 THEN 'underutilized'
        WHEN COUNT(d.id) BETWEEN 1 AND 3 THEN 'normal'
        ELSE 'high'
    END as utilization_level
FROM servers s
LEFT JOIN deployments d ON s.id = d.server_id
LEFT JOIN domains dom ON s.id = dom.server_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.provider, s.instance_type, s.monthly_price;