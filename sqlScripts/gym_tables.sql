-- Create GymSessions table
CREATE TABLE IF NOT EXISTS "GymSessions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  "session_date" date NOT NULL,
  "session_name" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create GymExercises table
CREATE TABLE IF NOT EXISTS "GymExercises" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "session_id" uuid REFERENCES "GymSessions"(id) ON DELETE CASCADE,
  "superset_number" integer NOT NULL,
  "exercise_name" text NOT NULL,
  "weight" decimal(10,2),
  "sets" integer NOT NULL,
  "reps" integer NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_gym_sessions_user_id" ON "GymSessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_gym_sessions_date" ON "GymSessions"("session_date");
CREATE INDEX IF NOT EXISTS "idx_gym_exercises_session_id" ON "GymExercises"("session_id");
CREATE INDEX IF NOT EXISTS "idx_gym_exercises_superset" ON "GymExercises"("session_id", "superset_number");

-- Enable Row Level Security
ALTER TABLE "GymSessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GymExercises" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for GymSessions
CREATE POLICY "Users can view their own gym sessions" ON "GymSessions"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gym sessions" ON "GymSessions"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gym sessions" ON "GymSessions"
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gym sessions" ON "GymSessions"
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for GymExercises
CREATE POLICY "Users can view exercises for their sessions" ON "GymExercises"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GymSessions" 
      WHERE "GymSessions".id = "GymExercises".session_id 
      AND "GymSessions".user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert exercises for their sessions" ON "GymExercises"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GymSessions" 
      WHERE "GymSessions".id = "GymExercises".session_id 
      AND "GymSessions".user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exercises for their sessions" ON "GymExercises"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "GymSessions" 
      WHERE "GymSessions".id = "GymExercises".session_id 
      AND "GymSessions".user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exercises for their sessions" ON "GymExercises"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "GymSessions" 
      WHERE "GymSessions".id = "GymExercises".session_id 
      AND "GymSessions".user_id = auth.uid()
    )
  );
