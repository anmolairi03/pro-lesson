'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, Lesson } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function Home() {
  const [outline, setOutline] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lessons:', error);
      return;
    }

    setLessons(data || []);
  }, []);

  useEffect(() => {
    fetchLessons();

    const channel = supabase
      .channel('lessons_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
        },
        (payload) => {
          console.log('Realtime event:', payload);
          fetchLessons();
        }
      )
      .subscribe((status) => {
        console.log('Channel status:', status);
      });

    const interval = setInterval(() => {
      fetchLessons();
    }, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchLessons]);

  const generateLesson = async () => {
    if (!outline.trim()) {
      return;
    }

    setIsGenerating(true);

    try {
      const { data: newLesson, error: insertError } = await supabase
        .from('lessons')
        .insert({
          outline: outline.trim(),
          status: 'generating',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating lesson:', insertError);
        alert('Failed to create lesson');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-lesson`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            lessonId: newLesson.id,
            outline: outline.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error generating lesson:', errorData);
      }

      setOutline('');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate lesson');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return;
    }

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting lesson:', error);
        alert('Failed to delete lesson');
        return;
      }

      setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete lesson');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generating':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating
          </Badge>
        );
      case 'generated':
        return <Badge className="bg-green-600 hover:bg-green-700">Generated</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <BookOpen className="h-12 w-12 text-blue-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              AI Lesson Generator
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your lesson outlines into comprehensive, interactive educational content powered by AI
          </p>
        </div>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Create a New Lesson
            </CardTitle>
            <CardDescription>
              Enter a lesson outline, topic, or description and let AI generate a complete lesson for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder="Example: 'A one-pager on how to divide with long division' or 'A 10-question pop quiz on Florida' or 'An explanation of how the Cartesian Grid works'"
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                className="min-h-32 text-base resize-none"
                disabled={isGenerating}
              />
            </div>
            <Button
              onClick={generateLesson}
              disabled={!outline.trim() || isGenerating}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Lesson...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Lesson
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Lessons</CardTitle>
            <CardDescription>
              {lessons.length === 0
                ? 'No lessons yet. Create your first lesson above!'
                : `${lessons.length} lesson${lessons.length !== 1 ? 's' : ''} generated`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lessons.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Lesson Outline</TableHead>
                      <TableHead className="font-semibold w-32">Status</TableHead>
                      <TableHead className="font-semibold w-40">Created</TableHead>
                      <TableHead className="font-semibold w-16 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons.map((lesson) => (
                      <TableRow
                        key={lesson.id}
                        className="group hover:bg-muted/30 transition-colors"
                      >
                        <TableCell>
                          {lesson.status === 'generated' ? (
                            <Link
                              href={`/lessons/${lesson.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-2 group"
                            >
                              <BookOpen className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              {lesson.outline}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {lesson.outline}
                            </span>
                          )}
                          {lesson.error_message && (
                            <p className="text-sm text-destructive mt-1">
                              Error: {lesson.error_message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(lesson.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lesson.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLesson(lesson.id)}
                            disabled={deletingId === lesson.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          >
                            {deletingId === lesson.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No lessons yet</p>
                <p className="text-sm">Create your first lesson to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
