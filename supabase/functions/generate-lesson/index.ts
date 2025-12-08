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

    console.log(`[${lessonId}] Starting generation with key present: ${!!geminiKey}`);

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
            maxOutputTokens: 1200,
            temperature: 0.7,
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

    let imageUrls: string[] = [];
    if (pexelsKey) {
      console.log(`[${lessonId}] Fetching images from Pexels...`);
      imageUrls = await fetchImagesFromPexels(outline.split(' ').slice(0, 3).join(' '), pexelsKey);
      console.log(`[${lessonId}] Found ${imageUrls.length} images`);
    }

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        title,
        content: generatedContent,
        image_urls: imageUrls,
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