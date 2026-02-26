-- Create users table for verification
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  picture TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Verification fields
  verification_status TEXT,
  didit_workflow_id TEXT,
  didit_session_id TEXT,
  face_hash TEXT,
  document_hash TEXT,
  verification_country TEXT,
  duplicate_detected BOOLEAN DEFAULT false,
  verification_attempt_count INTEGER DEFAULT 0,
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_level INTEGER,
  suspicious_verification BOOLEAN DEFAULT false,
  last_verification_attempt_at TIMESTAMP WITH TIME ZONE,
  verification_requested_at TIMESTAMP WITH TIME ZONE,
  last_verification_result JSONB
);

-- Create identity index table for duplicate detection
CREATE TABLE IF NOT EXISTS identity_index (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_identity_index_user_id ON identity_index(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_index_type ON identity_index(type);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_index ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role)
DROP POLICY IF EXISTS "Allow all for users" ON users;
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for identity_index" ON identity_index;
CREATE POLICY "Allow all for identity_index" ON identity_index FOR ALL USING (true) WITH CHECK (true);

