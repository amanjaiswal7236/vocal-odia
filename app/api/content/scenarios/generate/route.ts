import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { topic, context, difficulty } = await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 500 }
      );
    }

    // Generate scenario using AI
    const ai = new GoogleGenAI({ apiKey });
    
    const generationPrompt = `Generate a realistic English conversation practice scenario for an intermediate English learner from Odisha, India. 

Topic: ${topic}
${context ? `Additional context: ${context}` : ''}
${difficulty ? `Difficulty level: ${difficulty}` : ''}

Create a scenario with:
1. A clear, engaging title (max 50 characters)
2. A brief description (2-3 sentences) explaining what the learner will practice
3. An appropriate Font Awesome icon name (e.g., fa-coffee, fa-briefcase, fa-utensils)
4. A detailed prompt for the AI coach that sets the role and context (2-3 sentences)
5. A relevant image URL from Unsplash (optional, format: https://images.unsplash.com/photo-...)

Return ONLY a valid JSON object in this exact format:
{
  "title": "Scenario Title",
  "description": "Brief description of the scenario",
  "icon": "fa-icon-name",
  "prompt": "Detailed prompt for the AI coach role",
  "image": "https://images.unsplash.com/photo-..."
}

Make it practical, relevant to Indian/Odisha context, and focused on helping learners overcome common Odia-to-English translation mistakes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ parts: [{ text: generationPrompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    let scenarioData;
    try {
      scenarioData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText);
      // Fallback: create a basic scenario
      scenarioData = {
        title: topic,
        description: `Practice English conversation in a ${topic.toLowerCase()} scenario.`,
        icon: 'fa-comments',
        prompt: `You are a helpful English conversation partner. Help the learner practice English in a ${topic.toLowerCase()} context.`,
        image: null
      };
    }

    // Validate required fields
    if (!scenarioData.title || !scenarioData.prompt) {
      return NextResponse.json(
        { error: 'Failed to generate valid scenario' },
        { status: 500 }
      );
    }

    // Save scenario to database
    // Check if image column exists
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'scenarios' AND column_name = 'image'
      `);
      
      let result;
      if (columnCheck.rows.length > 0) {
        // Insert with image
        result = await query(
          'INSERT INTO scenarios (title, description, icon, prompt, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [
            scenarioData.title,
            scenarioData.description || '',
            scenarioData.icon || 'fa-comments',
            scenarioData.prompt,
            scenarioData.image || null
          ]
        );
      } else {
        // Insert without image
        result = await query(
          'INSERT INTO scenarios (title, description, icon, prompt) VALUES ($1, $2, $3, $4) RETURNING *',
          [
            scenarioData.title,
            scenarioData.description || '',
            scenarioData.icon || 'fa-comments',
            scenarioData.prompt
          ]
        );
      }

      const createdScenario = result.rows[0];
      return NextResponse.json({
        ...createdScenario,
        id: createdScenario.id.toString()
      });
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save scenario' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Error generating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to generate scenario' },
      { status: 500 }
    );
  }
}
