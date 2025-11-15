# AI Lesson Generator

A digital lesson generator app that transforms lesson outlines into comprehensive, interactive educational content powered by AI.

## Features

- **AI-Powered Generation**: Create complete lessons from simple outlines using OpenAI GPT-4
- **Real-Time Updates**: Watch lessons generate in real-time with Supabase Realtime subscriptions
- **Beautiful UI**: Modern, responsive design with Tailwind CSS and shadcn/ui components
- **TypeScript Support**: Full type safety throughout the application
- **No Authentication Required**: Anyone can use the app to generate lessons

## Tech Stack

- **Frontend**: Next.js 13, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (Database + Edge Functions)
- **AI**: OpenAI GPT-4 Turbo
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS with custom gradients

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Setup

The database schema is already set up with:
- `lessons` table with columns: id, title, outline, content, status, error_message, created_at
- Row Level Security (RLS) policies for public access
- Indexes for performance optimization

### 4. Edge Function Setup

The `generate-lesson` Edge Function is deployed to Supabase and handles:
- Receiving lesson generation requests
- Calling OpenAI API to generate content
- Updating lesson status in real-time
- Error handling and logging

**Important**: Ensure the `OPENAI_API_KEY` environment variable is configured in your Supabase project settings under Edge Functions secrets.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### 6. Build for Production

```bash
npm run build
npm start
```

## How It Works

1. **User Input**: Enter a lesson outline (e.g., "A one-pager on how to divide with long division")
2. **Generation**: Click "Generate Lesson" to trigger AI generation
3. **Real-Time Updates**: The lesson appears in the table with "Generating" status
4. **View Lesson**: Once generated, click the lesson to view the full content
5. **Markdown Rendering**: Lessons are beautifully rendered with syntax highlighting and formatting

## Example Lesson Outlines

- "A one-pager on how to divide with long division"
- "An explanation of how the Cartesian Grid works"
- "A test on counting numbers"
- "A 10-question pop quiz on Florida"
- "An introduction to TypeScript for beginners"

## Architecture

### Frontend Pages

- `/` - Home page with lesson creation form and lessons table
- `/lessons/[id]` - Individual lesson view page

### Backend Components

- **Supabase Database**: PostgreSQL database for storing lessons
- **Edge Function**: `generate-lesson` - Handles AI generation workflow
- **Real-Time Subscriptions**: Live updates when lessons are generated

### Data Flow

1. User submits outline → Frontend creates lesson record with status "generating"
2. Frontend calls Edge Function with lesson ID and outline
3. Edge Function calls OpenAI API to generate content
4. Edge Function updates lesson record with generated content and status "generated"
5. Supabase Realtime pushes update to frontend
6. UI automatically updates to show the generated lesson

## Reliability Features

- **Error Handling**: Comprehensive error handling at all layers
- **Status Tracking**: Clear status indicators (generating, generated, error)
- **Real-Time Feedback**: Users see updates immediately without refreshing
- **Logging**: Edge Function logs all steps for debugging

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Supabase Configuration

1. Database and Edge Functions are already configured
2. Ensure OPENAI_API_KEY is set in Supabase Edge Function secrets
3. No additional Supabase configuration needed

## Contributing

This app is designed for educational purposes and can be extended with:
- User authentication for saving personal lessons
- Lesson editing and regeneration
- Export to PDF or other formats
- Integration with AI-generated images or diagrams
- Lesson templates and categories

## License

MIT
