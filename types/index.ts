export enum AppMode {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LIVE_CONVERSATION = 'LIVE_CONVERSATION',
  SHADOWING = 'SHADOWING',
  STATS = 'STATS',
  ADMIN = 'ADMIN',
  COURSE_MAP = 'COURSE_MAP',
  COURSE_FEEDBACK = 'COURSE_FEEDBACK',
  USER_PROFILE = 'USER_PROFILE'
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum CourseLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  orderIndex?: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
  image?: string;
  isCourseLesson?: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  categoryId?: string | null;
  category?: Category | null;
}

export interface ShadowingTask {
  id: string;
  text: string;
  translation: string;
  focusArea: string;
}

export interface DailyQuest {
  id: string;
  label: string;
  target: number;
  current: number;
  completed: boolean;
  type: 'session' | 'word' | 'shadow';
}

export interface Lesson {
  id: string;
  title: string;
  objective: string;
  prompt: string;
  completed: boolean;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  level: CourseLevel;
  description: string;
  modules: Module[];
  prerequisiteId?: string;
  isUnlocked?: boolean;
  categoryId?: string | null;
  category?: Category | null;
}

export interface CourseFeedback {
  courseId: string;
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  nextSteps: string;
}

export interface DailyNugget {
  word: string;
  definition: string;
  example: string;
}

export interface UsageStats {
  tokensUsed: number;
  dailyTokens?: Array<{ date: string; tokens: number }>;
  userTokens?: Array<{ userId: string; name: string; avatar: string; tokens: number; sessions: number }>;
  sessionsCount: number;
  lastActive: number;
  errorCount: number;
  uniqueUsers?: number;
}

export interface UserUsage {
  id: string;
  name: string;
  avatar: string;
  tokens: number;
  sessions: number;
  lastActive: number;
  streak: number;
  mistakesFixed: string[];
}

export interface UserSession {
  id: string;
  scenarioId: string | null;
  scenarioTitle: string;
  isCourseLesson: boolean;
  courseId: string | null;
  tokensUsed: number;
  durationSeconds: number;
  startedAt: number;
  endedAt: number | null;
  sessionAudioUrl?: string | null;
}

export interface TranscriptionItem {
  id?: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  audioUrl?: string | null;
  detectedLanguage?: string | null;
  isFlagged?: boolean;
  feedback?: 'up' | 'down' | null;
  feedbackReason?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'user' | 'admin';
  tokens: number;
  sessions: number;
  lastActive: number;
  streak: number;
  mistakesFixed: string[];
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

