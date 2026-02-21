-- Create hub_user role for RLS policies
-- This must run BEFORE schema migration which references hub_user
-- Migration: 0000_setup_rls_role
-- Phase: 01-critical-setup-fixes, Plan: 01

DO $$
BEGIN
  -- Check if role exists to avoid duplicate error
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'hub_user'
  ) THEN
    -- Create the role
    CREATE ROLE hub_user;

    -- Grant schema usage
    GRANT USAGE ON SCHEMA public TO hub_user;

    -- Grant permissions on all existing tables
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hub_user;

    -- Grant permissions on all existing sequences
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hub_user;

    -- Ensure future tables inherit permissions
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hub_user;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO hub_user;

    RAISE NOTICE 'Created hub_user role with appropriate permissions';
  ELSE
    RAISE NOTICE 'hub_user role already exists';
  END IF;
END $$;
