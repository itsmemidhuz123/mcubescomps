-- Migration to add verification fields to users table
-- Run this in Supabase SQL Editor

-- Add verification columns to users table (if they don't exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationstatus VARCHAR(50) DEFAULT 'UNVERIFIED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS diditworkflowid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS diditsessionid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS facehash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS documenthash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationcountry VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS duplicatedetected BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationattemptcount INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verifiedat TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationlevel INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspiciousverification BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lastverificationattemptat TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationrequestedat TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lastverificationresult JSONB;

-- Create identity index table for duplicate detection
CREATE TABLE IF NOT EXISTS identityindex (
  id VARCHAR(255) PRIMARY KEY,
  userid VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_verificationstatus ON users(verificationstatus);
CREATE INDEX IF NOT EXISTS idx_identityindex_userid ON identityindex(userid);
CREATE INDEX IF NOT EXISTS idx_identityindex_type ON identityindex(type);

-- Enable RLS on identityindex
ALTER TABLE identityindex ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read identity index
CREATE POLICY "Allow read access to identity index" 
ON identityindex FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access to identity index" 
ON identityindex FOR ALL 
USING (auth.role() = 'service_role');
