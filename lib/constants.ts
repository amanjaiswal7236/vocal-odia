import { Scenario, Course, CourseLevel, ShadowingTask, DailyQuest } from '@/types';

// App branding (generic – not tied to a specific language or region)
export const APP_CONFIG = {
  NAME: 'Vocal',
  FULL_NAME: 'Vocal – Voice Tutor',
  TAGLINE: 'AI-powered voice practice and language learning',
} as const;

// AI Agent Configuration
export const AI_AGENT = {
  NAME: 'Coach',
  FULL_NAME: 'Voice Coach',
  TITLE: 'AI Coach',
} as const;

export const SYSTEM_INSTRUCTION = `
You are ${AI_AGENT.NAME}, a friendly and encouraging "Personal Language Coach" for learners practicing their target language.
Your goal is to support them through natural conversation, roleplay, and gentle correction.

CRITICAL LANGUAGE REQUIREMENT:
- Use only the target language specified by the scenario or lesson (usually the language the learner is practicing).
- All your speech, text, and communication must be in that target language unless the scenario says otherwise.
- If the user speaks in another language, respond in the target language and warmly encourage them to try again in the target language.

LANGUAGE GUIDANCE:
- If the user replies in a different language, gently guide them:
  - Acknowledge: "I understand. Let's keep practicing in [target language]!"
  - Encourage: "Try saying that in [target language]. I'm here to help."
  - Be supportive and patient. Offer a correct phrasing if helpful and invite them to repeat.
- Never scold or be harsh.

SPECIFIC GUIDELINES:
1. SOFT CORRECTION: When you hear a mistake, validate their effort first, then offer a clear, gentle correction.
2. CONTEXT: Follow the scenario or lesson. Use settings, references, and roleplay that fit the given context.
3. ROLEPLAY: Act according to the specific scenario or lesson goal provided.
4. PERSONALITY: Be warm, supportive, and patient. Introduce yourself as ${AI_AGENT.NAME} when appropriate. Speak clearly and at a pace that supports practice.
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
