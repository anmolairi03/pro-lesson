import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LessonRequest {
  lessonId: string;
  outline: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

async function generateQuizQuestions(outline: string, geminiKey: string): Promise<QuizQuestion[]> {
  try {
    const prompt = `Based on this lesson outline: "${outline}"

Generate exactly 5 multiple-choice quiz questions to test understanding. For each question:
1. Create a clear question
2. Provide 4 options (A, B, C, D)
3. Specify which option is correct (0-3)
4. Provide a brief explanation

Return as JSON array with this format:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Why this is correct"
  }
]

Return ONLY the JSON array, no other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`Quiz generation error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const quizText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!quizText) return [];

    const jsonMatch = quizText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) return [];

    const questions = JSON.parse(jsonMatch[0]);
    return Array.isArray(questions) ? questions.slice(0, 5) : [];
  } catch (error) {
    console.error('Error generating quiz:', error);
    return [];
  }
}

async function fetchImagesFromPexels(searchQuery: string, pexelsKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=landscape`,
      {
        headers: {
          'Authorization': pexelsKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`Pexels error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.photos?.map((photo: any) => photo.src.large) || [];
  } catch (error) {
    console.error('Error fetching images from Pexels:', error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { lessonId, outline }: LessonRequest = await req.json();

    if (!lessonId || !outline) {
      return new Response(
        JSON.stringify({ error: 'lessonId and outline are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const pexelsKey = Deno.env.get('PEXELS_API_KEY');

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const prompt = `Create a comprehensive, well-structured lesson (1200-1600 characters) about:

${outline}

Include:
1. Clear introduction
2. Main concepts with detailed explanations
3. Practical examples and use cases
4. Key takeaways (bullet points)
5. Practice questions (at least 3)

Use markdown with proper headings. Make it educational, engaging, and detailed.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1200,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[${lessonId}] Gemini error: ${errorText}`);
      throw new Error(`Gemini error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContent) {
      throw new Error('No content generated');
    }

    const title = outline.substring(0, 100).trim();

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        title,
        content: generatedContent,
        status: 'generated',
        generation_progress: {
          stage: 'completed',
          progress: 100,
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', lessonId);

    if (updateError) {
      console.error(`[${lessonId}] Update error:`, updateError);
      throw updateError;
    }

    if (typeof EdgeRuntime !== 'undefined') {
      const backgroundTasks = (async () => {
        try {
          const quizQuestions = await generateQuizQuestions(outline, geminiKey);
          let imageUrls: string[] = [];

          if (pexelsKey) {
            imageUrls = await fetchImagesFromPexels(outline.split(' ').slice(0, 3).join(' '), pexelsKey);
          }

          await supabase
            .from('lessons')
            .update({
              quiz_data: quizQuestions,
              image_urls: imageUrls,
            })
            .eq('id', lessonId);
        } catch (error) {
          console.error(`[${lessonId}] Background task error:`, error);
        }
      })();

      if (EdgeRuntime && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundTasks);
      }
    } else {
      const quizQuestions = await generateQuizQuestions(outline, geminiKey);
      let imageUrls: string[] = [];

      if (pexelsKey) {
        imageUrls = await fetchImagesFromPexels(outline.split(' ').slice(0, 3).join(' '), pexelsKey);
      }

      await supabase
        .from('lessons')
        .update({
          quiz_data: quizQuestions,
          image_urls: imageUrls,
        })
        .eq('id', lessonId);
    }

    return new Response(
      JSON.stringify({ success: true, lessonId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const body = await req.json().catch(() => ({ lessonId: null }));
      const lessonId = body?.lessonId;

      if (lessonId) {
        await supabase
          .from('lessons')
          .update({
            status: 'error',
            error_message: errorMessage.substring(0, 200),
            generation_progress: {
              stage: 'error',
              progress: 0,
              error: errorMessage,
            },
          })
          .eq('id', lessonId);
      }
    } catch (e) {
      console.error('Error updating error status:', e);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});