'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Lesson } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, BookOpen, Calendar, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    fetchLesson();

    const channel = supabase
      .channel(`lesson_${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lessons',
          filter: `id=eq.${params.id}`,
        },
        () => {
          fetchLesson();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  const fetchLesson = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching lesson:', fetchError);
        setError('Failed to load lesson');
        return;
      }

      if (!data) {
        setError('Lesson not found');
        return;
      }

      setLesson(data);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-10 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Lesson not found'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Link href="/">
          <Button variant="ghost" className="gap-2 hover:bg-white/50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <Card className="shadow-xl border-2">
          <CardHeader className="space-y-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>Lesson</span>
                </div>
                <CardTitle className="text-3xl font-bold leading-tight">
                  {lesson.title || lesson.outline}
                </CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Created {formatDistanceToNow(new Date(lesson.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            {lesson.status === 'generating' && (
              <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Generating Lesson</AlertTitle>
                <AlertDescription>
                  Your lesson is being generated by AI. This usually takes 10-30 seconds. The page
                  will update automatically when complete.
                </AlertDescription>
              </Alert>
            )}

            {lesson.status === 'error' && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Generation Failed</AlertTitle>
                <AlertDescription>
                  {lesson.error_message || 'An error occurred while generating the lesson.'}
                </AlertDescription>
              </Alert>
            )}

            {lesson.status === 'generated' && lesson.content && (
              <div className="space-y-8">
                <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:text-base prose-p:leading-relaxed prose-li:text-base prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:text-sm prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-bold mt-6 mb-3" {...props} />
                      ),
                      code: ({ node, className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code
                            className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ node, ...props }) => (
                        <pre
                          className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto my-6"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside space-y-2 my-4" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside space-y-2 my-4" {...props} />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="border-l-4 border-blue-500 pl-4 italic my-6 text-muted-foreground"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {lesson.content}
                  </ReactMarkdown>
                </div>

                {lesson.image_urls && lesson.image_urls.length > 0 && (
                  <div className="border-t pt-8 space-y-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Visual References</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {lesson.image_urls.map((imageUrl, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                        >
                          <img
                            src={imageUrl}
                            alt={`Lesson visual reference ${idx + 1}`}
                            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {lesson.status === 'generated' && !lesson.content && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Content</AlertTitle>
                <AlertDescription>
                  The lesson was marked as generated but no content is available.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
