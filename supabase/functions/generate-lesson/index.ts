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

    console.log(`[${lessonId}] Starting generation with key present: ${!!geminiKey}`);

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const prompt = `Create a brief, well-structured lesson (800-1200 characters max) about:

${outline}

Include: introduction, main points (bullet format), one example, and 3 practice questions.
Use markdown. Be concise.`;

    console.log(`[${lessonId}] Calling Gemini API...`);

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
            maxOutputTokens: 800,
            temperature: 0.5,
          },
        }),
      }
    );

    console.log(`[${lessonId}] Gemini response status: ${geminiResponse.status}`);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[${lessonId}] Gemini error: ${errorText}`);
      throw new Error(`Gemini error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContent) {
      console.error(`[${lessonId}] No content in response`);
      throw new Error('No content generated');
    }

    console.log(`[${lessonId}] Content generated: ${generatedContent.length} chars`);

    const title = outline.substring(0, 100).trim();

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        title,
        content: generatedContent,
        status: 'generated',
      })
      .eq('id', lessonId);

    if (updateError) {
      console.error(`[${lessonId}] Update error:`, updateError);
      throw updateError;
    }

    console.log(`[${lessonId}] Success`);

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