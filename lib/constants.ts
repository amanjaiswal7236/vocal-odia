import { Scenario, Course, CourseLevel, ShadowingTask, DailyQuest } from '@/types';

export const SYSTEM_INSTRUCTION = `
You are a "Personal Language Coach" for intermediate English learners from Odisha, India. 
Your goal is to help them overcome "Odinglish" (direct translations from Odia to English) through natural conversation.

SPECIFIC GUIDELINES:
1. SOFT CORRECTION: When you hear a common Odia-influenced mistake, don't just point it out. Validate their effort first, then offer the correction.
2. TARGET COMMON ODINGLISH ERRORS:
   - "staying since 5 years" -> "staying for 5 years".
   - "did not told" -> "did not tell".
   - "Myself [Name]" -> "I am [Name]".
3. CONTEXT: Use local references (Bhubaneswar, Cuttack, Puri, Rasagola, IT parks).
4. ROLEPLAY: Act according to the specific scenario or lesson goal provided.
`;

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

// UI Constants
export const UI_CONSTANTS = {
  TOAST_DURATION: {
    SHORT: 2000,
    MEDIUM: 3000,
    LONG: 5000,
  },
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  ESCAPE: 'Escape',
  HOME: { key: 'h', ctrl: true },
  PROFILE: { key: 'p', ctrl: true },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SIGNED_IN: 'Signed in successfully!',
  SIGNED_UP: 'Account created successfully!',
  SIGNED_OUT: 'Signed out successfully!',
  SAVED: 'Changes saved successfully!',
  UPDATED: 'Updated successfully!',
  DELETED: 'Deleted successfully!',
} as const;

