// Global type definitions for PhaseX project

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Session {
  id: number;
  date: string;
  type: string;
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