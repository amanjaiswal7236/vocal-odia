'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { GoogleGenAI, Type } from '@google/genai';
import CourseFeedbackView from '@/components/CourseFeedbackView';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import { CourseFeedback, Course } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

export default function CourseFeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const { courses, setCourses, loading } = useAppContext();
  const { showToast } = useToast();
  const [feedback, setFeedback] = useState<CourseFeedback | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
      return;
    }

    const generateFeedback = async () => {
      const courseId = params.id as string;
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      
      if (!apiKey) {
        showToast('AI feedback is not available. API key not configured.', 'warning');
        router.push('/courses');
        return;
      }

      const course = courses.find(c => c.id === courseId);
      if (!course) {
        showToast('Course not found', 'error');
        router.push('/courses');
        return;
      }

      try {
        showToast('Generating AI feedback...', 'info');
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: `Generate feedback JSON for Odia learner completing ${course.title}.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvementAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextSteps: { type: Type.STRING }
              },
              required: ["summary", "strengths", "improvementAreas", "nextSteps"]
            }
          }
        });
        setFeedback({ ...JSON.parse(response.text || '{}'), courseId });
        showToast('Feedback generated successfully!', 'success');
      } catch (e) {
        const errorMessage = getErrorMessage(e);
        console.error('Error generating feedback:', e);
        showToast('Failed to generate feedback. Please try again.', 'error');
        router.push('/courses');
      } finally {
        setGenerating(false);
      }
    };

    if (courses.length > 0) {
      generateFeedback();
    }
  }, [params.id, courses, router, loading, showToast]);

  if (loading || generating) {
    return <LoadingSpinner fullScreen text="Generating feedback..." />;
  }

  if (!feedback) {
    return null;
  }

  const course = courses.find(c => c.id === feedback.courseId);

  const handleContinue = () => {
    setCourses((prev: Course[]) => prev.map(c => 
      c.prerequisiteId === feedback.courseId ? { ...c, isUnlocked: true } : c
    ));
    router.push('/courses');
  };

  return (
    <CourseFeedbackView
      feedback={feedback}
      courseTitle={course?.title || ''}
      onContinue={handleContinue}
    />
  );
}

