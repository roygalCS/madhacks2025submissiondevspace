# DevSpace - AI-Powered Engineering Collaboration Platform

## Overview

DevSpace is a complete AI-powered engineering collaboration platform where users can work with AI "10x engineers" that have real codebase access, voice/video interaction, and task management capabilities.

## ✅ Completed Features

### 1. GitHub Integration (Phase 1 - Complete)

**Repository Connection:**
- GitHub username and repository name stored in Connections tab
- Connection status displayed in chat header
- Automatic repository context fetching for LLM

**File Fetching:**
- `fetchGitHubFile()` - Fetch specific files from repository
- `fetchRelevantGitHubFiles()` - Fetch common configuration files
- `fetchGitHubDirectory()` - List directory contents
- `fetchGitHubCommits()` - Get latest commits
- Base64 decoding for file contents
- Error handling for rate limits and missing files

**Code Review System:**
- Automatic file path extraction from user queries
- File-specific code review when user asks to "review [filename]"
- Line-numbered code formatting for LLM context
- Enhanced system prompts for code review analysis
- "View on GitHub" links in engineer responses

### 2. Enhanced Chat Experience (Complete)

**Voice & Text Communication:**
- Voice recording with FishAudio STT
- Text transcript display
- OpenRouter LLM integration (meta-llama/llama-3-8b-instruct)
- FishAudio TTS with play buttons
- Tavus video avatar generation

**Message Features:**
- Code block rendering with syntax highlighting
- Markdown support in messages
- "Assign as Task" button on engineer messages
- Audio and video playback controls
- Timestamp display

**Status Indicators:**
- "Analyzing [filename]..." status when fetching files
- "Engineer is thinking..." during LLM processing
- GitHub connection status in header
- Loading states for all async operations

**Conversation History:**
- Automatic persistence to localStorage
- History restored on page load
- Maintains message order and timestamps

### 3. Tavus Video Avatar Integration (Complete)

**Video Generation:**
- Automatic video generation for engineer responses
- Tavus API integration with polling for completion
- Video URL storage in messages
- Error handling with graceful fallback

**Video Call UI:**
- "Start Video Call" button in chat header
- Full-screen video call overlay
- Auto-play latest video when available
- "End Video Call" button
- Video player controls

### 4. Task Management System (Complete)

**Task Creation:**
- Create tasks from Tasks tab
- Assign tasks from chat (via "Assign as Task" button)
- Task assignment to specific engineers
- Status tracking (pending/running/completed)

**Task Display:**
- Task cards with status badges
- Engineer assignment display
- Output display for completed tasks
- Status icons (clock, spinner, checkmark)

### 5. Engineer Profiles (Complete)

**Engineer Management:**
- Create/edit/delete engineers
- Personality descriptions
- Tavus Avatar ID configuration
- Fish Audio Voice ID configuration
- Specialty selection (backend, frontend, fullstack, security, devops, mobile, ai/ml, general)

**Specialty Integration:**
- Specialty-specific system prompts
- Specialty badges on engineer cards
- Enhanced LLM responses based on specialty

## Technical Architecture

### API Integrations

1. **FishAudio API**
   - STT: `/v1/asr` (via proxy `/api/stt`)
   - TTS: `/api/v1/tts`
   - Voice IDs for different voices

2. **OpenRouter API**
   - Chat completions: `https://openrouter.ai/api/v1/chat/completions`
   - Model: `meta-llama/llama-3-8b-instruct` (configurable)
   - System prompts enhanced with engineer specialty

3. **Tavus API**
   - Video generation: `https://api.tavus.io/v2/replicas/{replica_id}/generate`
   - Video status polling: `https://api.tavus.io/v2/videos/{video_id}`
   - API key stored in connections table

4. **GitHub API**
   - File contents: `https://api.github.com/repos/{username}/{repo}/contents/{path}`
   - Directory listing: Same endpoint
   - Commits: `https://api.github.com/repos/{username}/{repo}/commits`
   - Optional authentication token for rate limits

### Database Schema

**Engineers Table:**
- `id` (UUID)
- `user_id` (UUID)
- `name` (TEXT)
- `personality` (TEXT, nullable)
- `tavus_avatar_id` (TEXT, nullable)
- `fish_voice_id` (TEXT, nullable)
- `specialty` (TEXT, nullable) - backend, frontend, fullstack, security, devops, mobile, ai/ml, general
- `created_at` (TIMESTAMP)

**Connections Table:**
- `id` (UUID)
- `user_id` (UUID)
- `cursor_api_key` (TEXT, nullable)
- `windmill_api_key` (TEXT, nullable)
- `github_token` (TEXT, nullable)
- `github_username` (TEXT, nullable)
- `github_repo_name` (TEXT, nullable)
- `tavus_api_key` (TEXT, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Tasks Table:**
- `id` (UUID)
- `user_id` (UUID)
- `description` (TEXT)
- `engineer_id` (UUID, nullable)
- `status` (TEXT) - pending, running, completed
- `output` (TEXT, nullable)
- `created_at` (TIMESTAMP)

### Key Components

1. **ChatTab** (`src/components/dashboard/ChatTab.tsx`)
   - Main chat interface
   - Voice recording and transcription
   - LLM integration with GitHub context
   - Video call UI
   - Message rendering with code blocks

2. **EngineersTab** (`src/components/dashboard/EngineersTab.tsx`)
   - Engineer CRUD operations
   - Specialty selection
   - Avatar and voice configuration

3. **TasksTab** (`src/components/dashboard/TasksTab.tsx`)
   - Task management
   - Task assignment
   - Status tracking

4. **ConnectionsTab** (`src/components/dashboard/ConnectionsTab.tsx`)
   - API key management
   - GitHub repository connection
   - Tavus API key configuration

### Utility Libraries

1. **GitHub Utils** (`src/lib/github.ts`)
   - File fetching
   - Directory listing
   - Commit history
   - File path extraction
   - Code formatting for reviews

2. **Tavus Utils** (`src/lib/tavus.ts`)
   - Video generation
   - Status polling
   - Video URL retrieval

## Setup Instructions

### 1. Environment Variables

Create a `.env` file with:

```env
# OpenRouter API
VITE_OPENROUTER_API_KEY=your_key_here
VITE_OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct

# FishAudio API
VITE_FISHAUDIO_API_KEY=your_key_here
VITE_FISHAUDIO_DEFAULT_VOICE_ID=802e3bc2b27e49c2995d23ef70e6ac89

# Supabase
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_key_here
```

### 2. Database Migrations

Run Supabase migrations:
- `20251122181653_318e4285-e1a4-4063-8332-9e903ec80358.sql` - Initial schema
- `20241122190000_add_github_repo_fields.sql` - GitHub and Tavus fields
- `20241122190001_add_engineer_specialty.sql` - Engineer specialty field

### 3. Configuration Steps

1. **Create Engineers:**
   - Go to Engineers tab
   - Create engineer with name, personality, specialty
   - Optionally add Tavus Avatar ID and Fish Voice ID

2. **Connect GitHub:**
   - Go to Connections tab
   - Enter GitHub username and repository name
   - Optionally add GitHub token for higher rate limits

3. **Configure Tavus:**
   - Go to Connections tab
   - Enter Tavus API key
   - Add Tavus Avatar ID to engineer profile

4. **Start Chatting:**
   - Go to Chat tab
   - Click microphone to record voice
   - Ask questions or request code reviews
   - Use "Start Video Call" for video avatar mode

## Usage Examples

### Code Review

**User:** "Review src/App.tsx"

**System:**
1. Extracts file path: `src/App.tsx`
2. Fetches file from GitHub
3. Formats with line numbers
4. Sends to LLM with code review prompt
5. Displays analysis with specific suggestions

### Task Assignment

**User:** Asks question in chat

**Engineer:** Provides response

**User:** Clicks "Assign as Task" button on engineer message

**System:** Creates task with engineer's response as description

### Video Avatar

**User:** Clicks "Start Video Call"

**System:**
1. Finds engineer with Tavus avatar
2. Opens video call overlay
3. Generates video for each engineer response
4. Auto-plays latest video

## Future Enhancements

Potential additions:
- Real-time file editing suggestions
- Code diff previews
- Multi-engineer collaboration
- Task automation workflows
- Integration with more code hosting platforms
- Advanced code analysis with AST parsing
- Performance profiling integration

## Notes

- Tavus API endpoint may need adjustment based on actual API documentation
- GitHub API rate limits: 60 requests/hour unauthenticated, 5000/hour authenticated
- Conversation history stored in localStorage (consider backend storage for production)
- All API keys stored securely in database, not in code

