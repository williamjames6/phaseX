// Global type definitions for PhaseX project

export interface User {
  id: string;
  email: string;
  created_at: string;
}

/** `GymSessions` table row (distinct name from the gym `GymSession` screen). */
export interface GymSessionRow {
  id: string;
  session_date: string;
  data: any;
  note?: string | null;
}

export interface Action {
  id: number;
  session_id: number;
  time_stamp: string;
  description: string;
}

export interface Sketch {
  id: number;
  user_id: string;
  description: string;
  created_at: string;
  updated_at: string;
} 

export interface Exercise {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  superset_number: number;
  exercise_number: number;
  sets: {
    reps: number | null;
    weight: number | null;
    time: number | null;
  }[];
}