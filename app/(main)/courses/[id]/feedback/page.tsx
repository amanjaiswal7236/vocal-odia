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
import { contentService } from '@/lib/services/contentService';

export default function CourseFeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const { courses, setCourses, loading, refreshContent, currentUser } = useAppContext();
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
          contents: `Generate feedback JSON for Odia learner completing ${course.title}. Provide encouraging, constructive feedback.`,
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
        
        const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        let feedbackData: any = {};
        
        try {
          feedbackData = JSON.parse(responseText);
        } catch (parseError) {
          // Try to extract JSON from markdown code blocks
          let jsonText = responseText.trim();
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').trim();
          }
          try {
            feedbackData = JSON.parse(jsonText);
          } catch (e) {
            console.error('Failed to parse feedback response:', e);
            throw new Error('Invalid feedback response format');
          }
        }
        
        // Validate required fields
        if (!feedbackData.summary || !feedbackData.strengths || !feedbackData.improvementAreas || !feedbackData.nextSteps) {
          throw new Error('Feedback response missing required fields');
        }
        
        setFeedback({ ...feedbackData, courseId });
        showToast('Feedback generated successfully!', 'success');
      } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('Error generating feedback:', e);
        showToast(`Failed to generate feedback: ${errorMessage}. Please try again.`, 'error');
        // Don't redirect immediately - let user see the error
        setTimeout(() => {
          router.push('/courses');
        }, 3000);
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

  const handleContinue = async () => {
    // Find courses that have this course as prerequisite
    const nextCourses = courses.filter(c => c.prerequisiteId === feedback.courseId);
    
    // Unlock next courses in database
    for (const nextCourse of nextCourses) {
      try {
        await contentService.unlockCourse(parseInt(nextCourse.id));
      } catch (err) {
        console.error(`Failed to unlock course ${nextCourse.id}:`, err);
      }
    }
    
    // Update local state
    setCourses((prev: Course[]) => prev.map(c => 
      c.prerequisiteId === feedback.courseId ? { ...c, isUnlocked: true } : c
    ));
    
    // Refresh content to get updated course states
    refreshContent();
    
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

