/**
 * Multi-Agent Manager for Parallel AI Engineers
 * Coordinates multiple agents working simultaneously with interruption support
 */

import {
  getOrCreateEngineerBranch,
  commitAndPush,
  pullFromBaseBranch,
  GitHubCommit,
} from './github-operations';
import { LLMService, LLMMessage } from './llm-service';
import { FishAudioTTS } from './fishaudio-service';
import { saveTask, getTasks, generateId, Task } from './localstorage-data';

export interface Agent {
  id: string;
  name: string;
  specialty: string | null;
  avatar_url: string | null;
  fish_voice_id: string | null; // FishAudio voice ID for TTS
  personality: string | null;
  isActive: boolean;
  currentTask: string | null; // Task ID if agent has an active task
  githubBranch?: string; // Engineer's branch name
  taskId?: string | null; // ID of the task assigned to this agent
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  text: string;
  timestamp: Date;
  taskId?: string;
  githubChanges?: {
    branch: string;
    commitUrl: string;
    filesChanged: string[];
  };
}

export class MultiAgentManager {
  private agents: Map<string, Agent> = new Map();
  private activeTTS: Set<string> = new Set(); // Track which agents are currently speaking
  private ttsQueue: Map<string, Array<{ text: string; resolve: () => void; reject: (error: Error) => void }>> = new Map(); // TTS queue per agent for sequential playback
  private isSpeaking: Map<string, boolean> = new Map(); // Track if agent is currently speaking
  private isUserSpeaking: boolean = false; // Track if user is currently speaking (prevents TTS from starting)
  private responseQueue: AgentResponse[] = [];
  private messageQueue: Array<{ message: string; context?: { githubRepo?: string; files?: string[]; agentNames?: string[]; userName?: string } }> = []; // Queue for user messages
  private isProcessingMessage = false; // Flag to prevent concurrent processing
  private onResponse: (response: AgentResponse) => void;
  private onInterruption: (interruptedAgentId: string, interruptingAgentId: string) => void;
  private githubConfig?: {
    username: string;
    repoName: string;
    token: string;
    baseBranch: string;
  };
  private fishAudioTTS?: FishAudioTTS; // FishAudio TTS instance
  private llmService?: LLMService; // LLM service via Supabase Edge Functions
  private onAgentLeaves?: (agentId: string, taskId: string) => void; // Callback when agent leaves
  private userName: string; // User's name for announcements
  private backgroundTaskExecutors: Map<string, Promise<void>> = new Map(); // Track background task executions

  constructor(
    onResponse: (response: AgentResponse) => void,
    onInterruption?: (interruptedAgentId: string, interruptingAgentId: string) => void,
    githubConfig?: { username: string; repoName: string; token: string; baseBranch?: string },
    fishAudioTTS?: FishAudioTTS, // Pass FishAudio TTS instance
    llmService?: LLMService, // Pass LLM service instance
    onAgentLeaves?: (agentId: string, taskId: string) => void, // Callback when agent leaves
    userName?: string // User's name for announcements
  ) {
    this.onResponse = onResponse;
    this.onInterruption = onInterruption || (() => {});
    this.githubConfig = githubConfig ? {
      ...githubConfig,
      baseBranch: githubConfig.baseBranch || 'main',
    } : undefined;
    this.fishAudioTTS = fishAudioTTS;
    this.llmService = llmService;
    this.onAgentLeaves = onAgentLeaves;
    this.userName = userName || 'Roy';
  }

  /**
   * Set FishAudio TTS instance
   */
  setFishAudioTTS(fishAudioTTS: FishAudioTTS): void {
    this.fishAudioTTS = fishAudioTTS;
    console.log('✅ FishAudio TTS instance set');
  }

  /**
   * Set LLM service instance
   */
  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
    console.log('✅ LLM service instance set');
  }

  /**
   * Set user speaking state (prevents TTS from starting while user is speaking)
   */
  setUserSpeaking(isSpeaking: boolean): void {
    this.isUserSpeaking = isSpeaking;
    if (isSpeaking) {
      console.log('👤 User is speaking - TTS will be delayed');
    } else {
      console.log('👤 User finished speaking - TTS can proceed');
    }
  }

  /**
   * Add an agent to the manager
   */
  addAgent(agent: Omit<Agent, 'isActive' | 'currentTask'>): void {
    // Ensure MVP avatars have correct voice IDs (fallback if not set)
    let voiceId = agent.fish_voice_id;
    if (!voiceId) {
      // Use default FishAudio voice ID from env
      voiceId = import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID || '802e3bc2b27e49c2995d23ef70e6ac89';
      console.log(`🔊 [MultiAgent] Agent ${agent.name} had no voice ID, using default: ${voiceId}`);
    }
    
    // Check if agent already exists and has a task
    const existingAgent = this.agents.get(agent.id);
    let taskId = null;
    let isActive = true;
    
    if (existingAgent && existingAgent.taskId) {
      // Agent has a task - check if it's completed
      const tasks = getTasks();
      const task = tasks.find(t => t.id === existingAgent.taskId);
      if (task?.status === 'completed') {
        // Task is completed - clear it
        console.log(`✅ [MultiAgent] ${agent.name}'s task is completed, clearing task reference`);
        taskId = null;
        isActive = true;
      } else {
        // Task is still running - keep task reference but don't activate
        taskId = existingAgent.taskId;
        isActive = false;
        console.log(`⏸️ [MultiAgent] ${agent.name} has active task ${taskId}, will not be active`);
      }
    }
    
    this.agents.set(agent.id, {
      ...agent,
      fish_voice_id: voiceId,
      isActive: isActive,
      currentTask: taskId,
      taskId: taskId,
    });
    
    console.log(`✅ [MultiAgent] Added agent: ${agent.name} (voice ID: ${voiceId}, isActive: ${isActive}, taskId: ${taskId || 'none'})`);
  }

  /**
   * Remove an agent completely from the manager
   */
  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    this.activeTTS.delete(agentId);
    this.isSpeaking.delete(agentId);
    this.ttsQueue.delete(agentId);
    this.agents.delete(agentId);
    console.log(`🗑️ [MultiAgent] Removed agent ${agentId} (${agent?.name || 'unknown'}) from manager`);
  }
  
  /**
   * Mark agent as inactive (leaving call but staying in manager for rejoining)
   */
  markAgentInactive(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.isActive = false;
      console.log(`⏸️ [MultiAgent] Marked ${agent.name} as inactive`);
    }
  }
  
  /**
   * Check for completed tasks and allow agents to rejoin
   */
  checkCompletedTasks(): void {
    const tasks = getTasks();
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.engineer_id);
    
    for (const task of completedTasks) {
      const agent = this.agents.get(task.engineer_id!);
      if (agent && agent.taskId === task.id) {
        // Agent has a completed task - they can rejoin
        console.log(`✅ [MultiAgent] ${agent.name} has completed task ${task.id}`);
        // Clear task reference so they can rejoin
        agent.taskId = null;
        agent.currentTask = null;
      }
    }
  }
  
  /**
   * Check if agent can rejoin (has completed their task)
   */
  canAgentRejoin(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    
    // If agent doesn't exist in manager yet, they can definitely join
    if (!agent) return true;
    
    // If agent has no task, they can rejoin
    if (!agent.taskId) return true;
    
    // Check if their task is completed
    const tasks = getTasks();
    const task = tasks.find(t => t.id === agent.taskId);
    return task?.status === 'completed';
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.isActive);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Process a user message and distribute to multiple agents in parallel
   * Uses a queue system to ensure messages are processed one at a time
   * and agents wait for each other to finish speaking
   */
  async processUserMessage(
    message: string,
    context?: { githubRepo?: string; files?: string[]; agentNames?: string[]; userName?: string }
  ): Promise<void> {
    console.log('📥 [MultiAgent] processUserMessage called:', { 
      message: message.substring(0, 100), 
      messageLength: message.length,
      queueLength: this.messageQueue.length, 
      isProcessing: this.isProcessingMessage,
      agentCount: this.agents.size,
      agentNames: Array.from(this.agents.values()).map(a => a.name)
    });
    
    // Add message to queue with context
    this.messageQueue.push({ message, context });
    
    // Process queue if not already processing
    if (!this.isProcessingMessage) {
      await this.processMessageQueue();
    }
  }

  /**
   * Process messages from the queue one at a time
   * Ensures agents wait for each other and don't interrupt
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingMessage || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingMessage = true;
    console.log('🔄 [MultiAgent] Starting message queue processing');

    while (this.messageQueue.length > 0) {
      const { message, context } = this.messageQueue.shift()!;
      console.log('📤 [MultiAgent] Processing queued message:', message);

      // Check if message is directed at a specific agent
      const allAgents = this.getAllAgents();
      const messageLower = message.toLowerCase();
      const addressedAgent = allAgents.find(agent => 
        messageLower.includes(agent.name.toLowerCase())
      );
      
      // Get agents to respond
      let agentsToRespond: Agent[] = [];
      
      if (addressedAgent) {
        // Message is directed at a specific agent - only that agent responds
        console.log(`🎯 [MultiAgent] Message directed at ${addressedAgent.name}`);
        // Check if agent doesn't have an active (non-completed) task
        if (!addressedAgent.taskId) {
          // No task - agent can respond
          agentsToRespond = [addressedAgent];
        } else {
          // Check if task is completed
          const tasks = getTasks();
          const task = tasks.find(t => t.id === addressedAgent.taskId);
          if (task?.status === 'completed') {
            // Task is completed - clear it and allow agent to respond
            addressedAgent.taskId = null;
            addressedAgent.currentTask = null;
            addressedAgent.isActive = true;
            agentsToRespond = [addressedAgent];
            console.log(`✅ [MultiAgent] ${addressedAgent.name}'s task is completed, allowing response`);
          } else {
            console.log(`⏸️ [MultiAgent] ${addressedAgent.name} has an active task, skipping`);
          }
        }
      } else {
        // Message is general - all active agents can respond
      const activeAgents = this.getActiveAgents();
      
      if (activeAgents.length === 0) {
        // If no active agents, activate only agents without active tasks
        this.agents.forEach(agent => {
          // Only reactivate agents that don't have an active (non-completed) task
          if (!agent.taskId) {
            agent.isActive = true;
          } else {
            // Check if task is completed
            const tasks = getTasks();
            const task = tasks.find(t => t.id === agent.taskId);
            if (task?.status === 'completed') {
              // Task is completed - clear it and reactivate
              agent.taskId = null;
              agent.currentTask = null;
              agent.isActive = true;
            }
            // If task is still running, keep agent inactive
          }
        });
      }

        agentsToRespond = this.getActiveAgents();
      }
      
      console.log(`🤖 [MultiAgent] ${agentsToRespond.length} agent(s) will respond to: "${message}"`);
      
      // Process agents in parallel for speed (they'll queue TTS automatically)
      // Get all agent names for context
      const allAgentNames = allAgents.map(a => a.name);
      const enhancedContext = {
        ...context,
        agentNames: allAgentNames,
        userName: this.userName || 'Roy', // User's name
      };
      
      // Process selected agents in parallel for maximum speed
      // TTS will queue automatically via the fishAudioTTS connection
      await Promise.all(
        agentsToRespond.map(agent => 
          this.processAgentResponse(agent.id, message, enhancedContext)
        )
      );
    }

    this.isProcessingMessage = false;
    console.log('✅ [MultiAgent] Message queue processing complete');
  }

  /**
   * Wait for all currently speaking agents to finish
   * If user is speaking again, interrupt agents for faster response
   */
  private async waitForSilence(): Promise<void> {
    const maxWaitTime = 2000; // Max 2 seconds (reduced for faster response)
    const checkInterval = 50; // Check every 50ms (faster polling)
    const startTime = Date.now();

    while (this.activeTTS.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      // If there's a new message in queue, interrupt current speakers for faster response
      if (this.messageQueue.length > 1) {
        console.log(`⚡ [MultiAgent] New message detected, interrupting current speakers for faster response`);
        this.interruptAllSpeaking();
        break;
      }
      
      if (this.activeTTS.size > 0) {
        // Only log every 10th check to reduce console spam
        const elapsed = Date.now() - startTime;
        if (elapsed % 500 < checkInterval) {
          console.log(`⏳ [MultiAgent] Waiting for ${this.activeTTS.size} agent(s) to finish speaking...`);
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    if (this.activeTTS.size > 0) {
      console.log('✅ [MultiAgent] Proceeding (agents may still be speaking, but continuing for faster response)');
    } else {
      console.log('✅ [MultiAgent] All agents finished speaking, proceeding with next message');
    }
  }

  /**
   * Process a single agent's response
   */
  private async processAgentResponse(
    agentId: string,
    userMessage: string,
    context?: { githubRepo?: string; files?: string[] }
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`⚠️ [MultiAgent] Agent ${agentId} not found in manager`);
      return;
    }

    // Only mark as active if they don't have an active task
    if (!agent.taskId) {
    agent.isActive = true;
    } else {
      // Check if task is completed
      const tasks = getTasks();
      const task = tasks.find(t => t.id === agent.taskId);
      if (task?.status === 'completed') {
        agent.taskId = null;
        agent.currentTask = null;
        agent.isActive = true;
        console.log(`✅ [MultiAgent] ${agent.name}'s task completed, activating agent`);
      } else {
        console.log(`⏸️ [MultiAgent] ${agent.name} has active task, keeping inactive`);
        return; // Don't process response if agent has active task
      }
    }

    try {
      // Start branch creation in parallel (only if needed) - don't block response generation
      let branchPromise: Promise<void> | null = null;
      if (this.githubConfig && !agent.githubBranch) {
        branchPromise = (async () => {
          try {
            agent.githubBranch = await getOrCreateEngineerBranch(
              this.githubConfig!.username,
              this.githubConfig!.repoName,
              agent.id,
              agent.name,
              this.githubConfig!.token,
              this.githubConfig!.baseBranch
            );
            console.log(`✅ ${agent.name} working on branch: ${agent.githubBranch}`);
          } catch (error) {
            console.error(`❌ Failed to create branch for ${agent.name}:`, error);
            // Continue without branch - agent can still respond but can't commit
          }
        })();
      }

      // Pull latest changes in background (fire and forget - don't block anything)
      if (this.githubConfig && agent.githubBranch) {
        pullFromBaseBranch(
          this.githubConfig.username,
          this.githubConfig.repoName,
          agent.githubBranch,
          this.githubConfig.baseBranch,
          this.githubConfig.token
        ).then(() => {
          console.log(`✅ ${agent.name} pulled latest from ${this.githubConfig!.baseBranch}`);
        }).catch((error) => {
          console.warn(`⚠️ Failed to pull latest changes for ${agent.name} (continuing anyway):`, error);
        });
      }

      // Generate response with streaming for ultra-fast, human-like response
      console.log(`🤖 [MultiAgent] Generating streaming response for ${agent.name}...`);
      let fullResponse = '';
      
      // Wait for complete response before starting TTS to ensure proper sentences
      const response = await this.generateAgentResponse(
        agent,
        userMessage,
        context,
        (chunk: string, fullText: string) => {
          fullResponse = fullText;
          // Don't start TTS during streaming - wait for complete response
        }
      );
      
      // Use the final response (from streaming or non-streaming)
      const finalResponse = fullResponse || response;
      
      // Validate response is not empty
      if (!finalResponse || finalResponse.trim().length === 0) {
        console.warn(`⚠️ [MultiAgent] Empty response from ${agent.name}, using fallback`);
        const fallbackResponse = `I heard you, ${context?.userName || 'user'}. How can I help?`;
        console.log(`✅ [MultiAgent] Using fallback response for ${agent.name}, length: ${fallbackResponse.length}`);
        // Continue with fallback response
        const agentResponse: AgentResponse = {
          agentId: agent.id,
          agentName: agent.name,
          text: fallbackResponse,
          timestamp: new Date(),
        };
        this.onResponse(agentResponse);
        return; // Skip TTS for empty responses
      }
      
      // Only wait for branch creation if we need it for a commit (check happens later)
      // This allows response generation to proceed without waiting
      console.log(`✅ [MultiAgent] Full response generated for ${agent.name}, length: ${finalResponse.length}`);
      
      // Parse response for GitHub commit instructions
      let githubChanges: AgentResponse['githubChanges'] | undefined;
      // Match JSON code blocks with commit action (multiline)
      // Multiple agents can commit in parallel - each has their own branch
      const commitMatch = finalResponse.match(/```json\s*([\s\S]*?\{[\s\S]*?"action"\s*:\s*"commit"[\s\S]*?\}[\s\S]*?)\s*```/);
      
      // If we need to commit, wait for branch creation (if it's still in progress)
      if (commitMatch && this.githubConfig && branchPromise) {
        await branchPromise;
      }
      
      if (commitMatch && this.githubConfig && agent.githubBranch) {
        try {
          console.log(`💾 ${agent.name} attempting to commit changes...`);
          const commitJson = commitMatch[1].trim();
          const commitData: { message: string; files: Array<{ path: string; content: string; operation: string }> } = JSON.parse(commitJson);
          
          // Validate commit data
          if (!commitData.files || commitData.files.length === 0) {
            throw new Error('No files specified in commit');
          }

          // Ensure commit message includes agent name
          const commitMessage = commitData.message 
            ? commitData.message.includes(agent.name) 
              ? commitData.message 
              : `${agent.name}: ${commitData.message}`
            : `${agent.name}: ${userMessage.substring(0, 50)}`;

          const commit: GitHubCommit = {
            message: commitMessage,
            files: commitData.files.map(f => ({
              path: f.path,
              content: f.content,
              operation: f.operation as 'create' | 'update' | 'delete',
            })),
          };

          console.log(`📝 ${agent.name} committing ${commit.files.length} file(s) to branch ${agent.githubBranch}`);

          // Commit and push (works for both public and private repos)
          const result = await commitAndPush(
            this.githubConfig.username,
            this.githubConfig.repoName,
            agent.githubBranch!,
            commit,
            agent.name,
            this.githubConfig.token
          );

          githubChanges = {
            branch: agent.githubBranch!,
            commitUrl: result.commitUrl,
            filesChanged: commit.files.map(f => f.path),
          };

          // Update response text to include commit info
          const updatedResponse = finalResponse.replace(
            commitMatch[0],
            `✅ **Committed to branch \`${agent.githubBranch}\`**: ${result.commitUrl}\n\n**Files changed:**\n${commit.files.map(f => `- \`${f.path}\` (${f.operation})`).join('\n')}`
          );
          
          console.log(`✅ ${agent.name} successfully committed ${commit.files.length} file(s)`);
          
          // Mark task as completed if agent has an active task
          if (agent.taskId) {
            const tasks = getTasks();
            const task = tasks.find(t => t.id === agent.taskId);
            if (task && task.status === 'running') {
              task.status = 'completed';
              task.output = `Committed ${commit.files.length} file(s) to branch ${agent.githubBranch}. Files: ${commit.files.map(f => f.path).join(', ')}. Commit: ${result.commitUrl}`;
              saveTask(task);
              console.log(`✅ [MultiAgent] Marked task ${agent.taskId} as completed for ${agent.name}`);
              
              // Clear task reference so agent can rejoin
              agent.taskId = null;
              agent.currentTask = null;
              agent.isActive = true; // Reactivate agent since task is done
            }
          } else {
            // If no task exists but this was a task request, create and immediately complete it
            const taskKeywords = ['create', 'make', 'build', 'implement', 'add', 'write', 'do', 'task', 'work on', 'handle', 'edit', 'update', 'modify', 'change', 'fix', 'refactor'];
            const messageLower = userMessage.toLowerCase();
            const hasTaskKeyword = taskKeywords.some(keyword => messageLower.includes(keyword));
            
            if (hasTaskKeyword) {
              // Generate task name
              let taskName = `Execute: ${userMessage.substring(0, 50)}`;
              try {
                const taskNamePrompt = `Generate a concise, descriptive task name (max 60 characters) for this instruction: "${userMessage}". Return ONLY the task name, nothing else.`;
                if (!this.llmService) {
                  throw new Error('LLM service not available');
                }
                const taskNameResponse = await this.llmService.generate(
                  [{ role: 'user', content: taskNamePrompt }],
                  'You are a task naming assistant. Generate concise, descriptive task names.',
                  {
                    model: import.meta.env.VITE_LLM_MODEL || 'meta-llama/llama-3-8b-instruct',
                    temperature: 0.3,
                    maxTokens: 100,
                  }
                );
                taskName = taskNameResponse.trim().replace(/['"]/g, '').substring(0, 60) || taskName;
              } catch (e) {
                // Use fallback
              }
              
              const taskId = generateId();
              const task: Task = {
                id: taskId,
                description: taskName,
                engineer_id: agent.id,
                status: 'completed',
                output: `Committed ${commit.files.length} file(s) to branch ${agent.githubBranch}. Files: ${commit.files.map(f => f.path).join(', ')}. Commit: ${result.commitUrl}`,
                created_at: new Date().toISOString(),
              };
              saveTask(task);
              console.log(`✅ [MultiAgent] Created and completed task ${taskId} for ${agent.name} (executed via commit)`);
            }
          }
          
          const agentResponse: AgentResponse = {
            agentId: agent.id,
            agentName: agent.name,
            text: updatedResponse,
            timestamp: new Date(),
            taskId: agent.taskId || undefined,
            githubChanges,
          };

          // Add to response queue
          this.responseQueue.push(agentResponse);

          // Notify listeners IMMEDIATELY so message appears in UI right away
          this.onResponse(agentResponse);

          // Queue the response for sequential playback
          this.queueTTS(agent.id, updatedResponse).catch((error) => {
            if (!this.agents.has(agent.id)) {
              console.log(`ℹ️ TTS cancelled for ${agent.name} - agent was removed`);
              return;
            }
            console.error(`Error queuing GitHub commit response for ${agent.name}:`, error);
          });
          return;
        } catch (error) {
          console.error(`❌ Error processing GitHub commit for ${agent.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Add error to response so user knows what happened
          const errorResponse = finalResponse + `\n\n⚠️ **Commit failed**: ${errorMessage}\n\nMake sure:\n- GitHub token has 'repo' scope\n- Repository exists and is accessible\n- You have write access to the repository`;
          
          // Continue with error response
          const agentResponse: AgentResponse = {
            agentId: agent.id,
            agentName: agent.name,
            text: errorResponse,
            timestamp: new Date(),
          };
          
          this.onResponse(agentResponse);
          this.queueTTS(agent.id, errorResponse).catch(() => {
            // Silently handle if agent was removed
            if (!this.agents.has(agent.id)) {
              return;
            }
          });
          // Don't return - continue with normal flow
        }
      }
      
      const agentResponse: AgentResponse = {
        agentId: agent.id,
        agentName: agent.name,
        text: finalResponse,
        timestamp: new Date(),
        githubChanges,
      };

      // Add to response queue
      this.responseQueue.push(agentResponse);

      console.log(`📢 Agent ${agent.name} generated response, length: ${finalResponse.length}`);
      console.log(`📢 Response preview: ${finalResponse.substring(0, 100)}...`);

      // Notify listeners IMMEDIATELY so message appears in UI right away
      // This happens before TTS so user sees the response immediately
      console.log(`📨 Notifying listeners about response from ${agent.name} (IMMEDIATE)`);
      this.onResponse(agentResponse);

      // Check if this is a task/direction that requires the agent to leave the call
      // Only create a task if:
      // 1. Message contains task keywords AND
      // 2. Message is clearly directed at this agent (mentions their name OR only one agent in call OR uses "you" when message was addressed to them)
      // 3. Message appears to be a complete command (not a partial sentence)
      const taskKeywords = ['create', 'make', 'build', 'implement', 'add', 'write', 'do', 'task', 'work on', 'handle', 'edit', 'update', 'modify', 'change', 'fix', 'refactor'];
      const messageLower = userMessage.toLowerCase().trim();
      const agentNameLower = agent.name.toLowerCase();
      const hasTaskKeyword = taskKeywords.some(keyword => messageLower.includes(keyword));
      
      // Check if message is directed at this agent
      // Only respond if the agent's name is explicitly mentioned in the message
      const isDirectedAtAgent = messageLower.includes(agentNameLower);
      
      // Check if response already contains a commit (if so, task was handled during commit processing)
      const hasCommitInResponse = githubChanges !== undefined || 
                                   finalResponse.includes('"action": "commit"') || 
                                   finalResponse.match(/```json[\s\S]*?"action"\s*:\s*"commit"/);
      
      // Only treat as task request if it looks like a complete command (ends with punctuation or is a clear imperative)
      const looksLikeCompleteCommand = /[.!?]$/.test(userMessage.trim()) || 
                                        messageLower.split(/\s+/).length >= 3; // At least 3 words (e.g., "Alex create file")
      
      // If it's a task request, we want the agent to leave and work on it in the background
      // Even if they generated a commit, we should still have them leave (the commit will be ignored and task will be created)
      const isTaskRequest = hasTaskKeyword && isDirectedAtAgent && looksLikeCompleteCommand;

      // Debug logging for task detection
      console.log(`🔍 [MultiAgent] Task detection for ${agent.name}:`, {
        hasTaskKeyword,
        isDirectedAtAgent,
        hasCommitInResponse,
        looksLikeCompleteCommand,
        isTaskRequest,
        hasExistingTask: !!agent.taskId,
        message: userMessage.substring(0, 50)
      });

      // If this is a task request, we need to:
      // 1. Let the agent speak their response first (which should acknowledge the task)
      // 2. Then create the task and leave after TTS completes
      if (isTaskRequest && !agent.taskId) {
        console.log(`✅ [MultiAgent] Task request detected for ${agent.name}, will leave after responding`);
        // First, queue TTS for the agent's response so they can answer before leaving
        if (finalResponse && finalResponse.trim().length > 0) {
          console.log(`🔊 [MultiAgent] Agent ${agent.name} will speak their response first, then leave`);
          try {
            // Queue and wait for the response to be spoken
            await this.queueTTS(agent.id, finalResponse);
            console.log(`✅ [MultiAgent] ${agent.name} finished speaking their response`);
          } catch (error) {
            console.error(`Error queuing response TTS for ${agent.name}:`, error);
          }
        }

        // Now create the task and leave
        try {
          // Generate a concise task name using AI
          let taskName = userMessage.substring(0, 60);
          try {
            const taskNamePrompt = `Generate a concise, descriptive task name (max 60 characters) for this instruction: "${userMessage}". Return ONLY the task name, nothing else.`;
            if (!this.llmService) {
              throw new Error('LLM service not available');
            }
            const taskNameResponse = await this.llmService.generate(
              [{ role: 'user', content: taskNamePrompt }],
              'You are a task naming assistant. Generate concise, descriptive task names based on the user instruction.',
              {
                model: import.meta.env.VITE_LLM_MODEL || 'meta-llama/llama-3-8b-instruct',
                temperature: 0.3,
                maxTokens: 100,
              }
            );
            taskName = taskNameResponse.trim().replace(/['"]/g, '').substring(0, 60) || taskName;
            console.log(`📝 [MultiAgent] Generated task name for ${agent.name}: "${taskName}"`);
          } catch (nameError) {
            console.warn(`⚠️ [MultiAgent] Failed to generate task name, using fallback:`, nameError);
          }
          
          // Create task
          const taskId = generateId();
          // Alex's tasks are automatically completed
          const isAlex = agent.name.toLowerCase().includes('alex');
          const taskStatus = isAlex ? 'completed' : 'running';
          const task: Task = {
            id: taskId,
            description: taskName,
            engineer_id: agent.id,
            status: taskStatus,
            output: null,
            created_at: new Date().toISOString(),
          };
          
          console.log(`📋 [MultiAgent] Creating task for ${agent.name} (isAlex: ${isAlex}):`, {
            taskId,
            taskName,
            status: taskStatus,
            agentName: agent.name
          });
          
          saveTask(task);
          
          // Verify the task was saved correctly - check multiple times to ensure it persists
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            const savedTasks = getTasks();
            const savedTask = savedTasks.find(t => t.id === taskId);
            if (savedTask) {
              console.log(`✅ [MultiAgent] Task saved with status: ${savedTask.status} (check ${i + 1}/3)`);
              if (savedTask.status !== taskStatus) {
                console.error(`❌ [MultiAgent] Task status mismatch! Expected ${taskStatus}, got ${savedTask.status}`);
                // Fix it
                savedTask.status = taskStatus;
                saveTask(savedTask);
                console.log(`🔧 [MultiAgent] Fixed task status to ${taskStatus}`);
              } else {
                break; // Status is correct, no need to check again
              }
            } else if (i === 0) {
              console.error(`❌ [MultiAgent] Task not found after saving! Retrying...`);
              // Try saving again
              saveTask(task);
            }
          }
          
          agent.taskId = taskId;
          agent.currentTask = taskId;
          agent.isActive = false;
          
          console.log(`📋 [MultiAgent] Created task ${taskId} for ${agent.name}: ${taskName} (status: ${taskStatus})`);
          
          // Now clear TTS and leave after response has been spoken
          this.interruptAgent(agent.id);
          if (this.fishAudioTTS) {
            this.fishAudioTTS.stop();
          }
          
          // Clear TTS queue for this agent
          const agentQueue = this.ttsQueue.get(agent.id);
          if (agentQueue) {
            agentQueue.forEach(item => item.reject(new Error('Agent leaving call')));
            this.ttsQueue.delete(agent.id);
          }
          this.isSpeaking.delete(agent.id);
          this.activeTTS.delete(agent.id);
          
          console.log(`👋 [MultiAgent] ${agent.name} leaving call to work on task`);
          agent.isActive = false;
          
          // Remove agent from active agents list via callback
          if (this.onAgentLeaves) {
            console.log(`📞 [MultiAgent] Calling onAgentLeaves callback for ${agent.name} (${agent.id})`);
            this.onAgentLeaves(agent.id, taskId);
            console.log(`✅ [MultiAgent] onAgentLeaves callback completed for ${agent.name}`);
          } else {
            console.warn(`⚠️ [MultiAgent] onAgentLeaves callback is not set! Agent ${agent.name} won't be removed from UI`);
          }
          
          // Also ensure agent is not included in future message processing
          // by keeping isActive = false (already set above)
          console.log(`✅ [MultiAgent] ${agent.name} marked as inactive (isActive=false, taskId=${taskId})`);
          
          return; // Don't continue with normal response flow
        } catch (error) {
          console.error(`❌ Error creating task for ${agent.name}:`, error);
          // Even if task creation fails, try to remove agent from call if it was a task request
          if (this.onAgentLeaves) {
            console.log(`📞 [MultiAgent] Calling onAgentLeaves callback despite error for ${agent.name}`);
            // Generate a temporary task ID for the callback
            const tempTaskId = generateId();
            this.onAgentLeaves(agent.id, tempTaskId);
          }
          // Continue with normal response if task creation fails
        }
      } else if (isTaskRequest && agent.taskId) {
        console.log(`⏸️ [MultiAgent] ${agent.name} already has a task (${agent.taskId}), skipping task creation`);
      } else if (hasTaskKeyword && isDirectedAtAgent && !isTaskRequest) {
        console.log(`⚠️ [MultiAgent] Task keyword detected for ${agent.name} but conditions not met:`, {
          hasCommitInResponse,
          looksLikeCompleteCommand
        });
      }

      // Only queue TTS if response is not empty and we haven't already queued it above
      if (finalResponse && finalResponse.trim().length > 0) {
        // Queue the full response now that it's complete
        console.log(`🔊 [MultiAgent] Queueing full response for ${agent.name} to speak (length: ${finalResponse.length})`);
        console.log(`🔊 [MultiAgent] Response preview: "${finalResponse.substring(0, 100)}..."`);
        console.log(`🔊 [MultiAgent] FishAudio TTS available: ${!!this.fishAudioTTS}`);
        this.queueTTS(agent.id, finalResponse).catch((speakError) => {
          if (!this.agents.has(agent.id)) {
            console.log(`ℹ️ TTS cancelled for ${agent.name} - agent was removed (call likely ended)`);
            return;
          }
          console.error(`❌ queueTTS failed for ${agent.name}:`, speakError);
        });
      } else {
        console.warn(`⚠️ [MultiAgent] Empty response from ${agent.name}, skipping TTS`);
      }
    } catch (error) {
      console.error(`Error processing agent ${agent.name}:`, error);
    }
  }

  /**
   * Generate response for a specific agent with streaming support
   * Returns a promise that resolves with the full response, but also calls onChunk for each chunk
   */
  private async generateAgentResponse(
    agent: Agent,
    userMessage: string,
    context?: { githubRepo?: string; files?: string[]; agentNames?: string[]; userName?: string },
    onChunk?: (chunk: string, fullText: string) => void
  ): Promise<string> {
    // Use LLM Service (Supabase Edge Functions) for code generation
    if (!this.llmService) {
      throw new Error('LLM service is required. Please set it using setLLMService().');
    }
    
    const model = import.meta.env.VITE_LLM_MODEL || 'meta-llama/llama-3-8b-instruct';

    // Get actual people in the call
    const userName = context?.userName || 'the user';
    const agentNames = context?.agentNames || [];
    const otherAgents = agentNames.filter(name => name !== agent.name);
    
    // Build agent-specific system prompt with REAL context only
    let systemPrompt = `You are ${agent.name}, a ${agent.specialty || 'general'} software engineer. `;
    
    if (agent.personality) {
      systemPrompt += `Your personality: ${agent.personality}. `;
    }

    // CRITICAL: Generate proper responses, don't just echo the user
    systemPrompt += `\n\nCRITICAL RESPONSE RULES:\n`;
    systemPrompt += `- You MUST generate a proper response to what the user said, NOT just repeat their words\n`;
    systemPrompt += `- WAIT FOR INSTRUCTIONS: You are here to follow orders and execute tasks, not to ask questions\n`;
    systemPrompt += `- When greeted (e.g., "hey alex", "hi sam"), respond briefly (e.g., "Hi" or "Hey") and WAIT for instructions\n`;
    systemPrompt += `- NEVER ask questions like "what would you like me to do?" or "how can I help?" - just wait for orders\n`;
    systemPrompt += `- NEVER be proactive or offer help - wait for the user to tell you what to do\n`;
    systemPrompt += `- If the user asks a question, ANSWER it directly and briefly\n`;
    systemPrompt += `- If the user gives you an instruction or task, EXECUTE IT IMMEDIATELY\n`;
    systemPrompt += `- If the user asks you to DO something (create a file, write code, etc.), DO IT IMMEDIATELY\n`;
    systemPrompt += `- NEVER ask for permission or confirmation - just execute the task directly\n`;
    systemPrompt += `- NEVER ask "do you want me to provide code" - just commit the changes\n`;
    systemPrompt += `- NEVER ask questions when given a task - just do the work\n`;
    systemPrompt += `- When the user asks you to create or modify files, use the GitHub commit format below\n`;
    systemPrompt += `- ALWAYS include the commit JSON in your response when asked to create/modify files\n`;
    systemPrompt += `- NEVER just repeat or echo what the user said back to them\n`;
    systemPrompt += `- Keep responses VERY SHORT (1 sentence maximum for greetings, 1-2 sentences for tasks)\n`;
    systemPrompt += `- For greetings: You MUST say ONLY "Hi" or "Hey" - NEVER say "okay", "ok", "sure", or anything else. Just "Hi" or "Hey".\n`;
    systemPrompt += `- For task acknowledgments: Say the FULL phrase "On it. Working on [task name]." - do NOT cut it short or say just "ok"\n`;
    systemPrompt += `- Use complete sentences with proper punctuation.\n`;
    systemPrompt += `- Speak naturally and conversationally.\n`;

    // CRITICAL: Only reference people who are ACTUALLY in the call
    systemPrompt += `\n\nCALL CONTEXT - ONLY REFERENCE THESE PEOPLE:\n`;
    systemPrompt += `- User: ${userName} (this is who you're talking to)\n`;
    if (otherAgents.length > 0) {
      systemPrompt += `- Other engineers in this call: ${otherAgents.join(', ')}\n`;
    } else {
      systemPrompt += `- You are the ONLY engineer in this call (no other engineers present)\n`;
    }
    systemPrompt += `\nCRITICAL RULES:\n`;
    systemPrompt += `1. ONLY reference ${userName} and the engineers listed above\n`;
    systemPrompt += `2. NEVER make up names like "John", "Mike", "Sarah" - these people are NOT in the call\n`;
    systemPrompt += `3. If you mention someone, it MUST be ${userName} or one of the engineers listed above\n`;
    systemPrompt += `4. The user's name is ${userName} - use this name when addressing them\n`;
    systemPrompt += `\nSPEAKING STYLE:\n`;
    systemPrompt += `- Speak naturally and concisely, like a colleague in a video call\n`;
    systemPrompt += `- Answer questions directly without filler phrases like "if you need help" or "let me know if you have questions"\n`;
    systemPrompt += `- Be conversational and brief - no long explanations unless asked\n`;
    systemPrompt += `- Don't add unnecessary closing phrases or offer help that wasn't requested\n`;
    systemPrompt += `- WAIT FOR ORDERS: After greeting or acknowledging, wait for the user to tell you what to do\n`;
    systemPrompt += `- NEVER ask "what would you like me to do?" or similar questions - just wait silently for instructions\n`;
    systemPrompt += `- Focus on your specialty: ${agent.specialty || 'general engineering'}\n`;
    
    // GitHub operations capability - CRITICAL for parallel editing
    if (this.githubConfig) {
      systemPrompt += `\n\n🚀 GITHUB REPOSITORY ACCESS:\n`;
      systemPrompt += `Repository: ${this.githubConfig.username}/${this.githubConfig.repoName}\n`;
      systemPrompt += `Your branch: ${agent.githubBranch || 'your branch'}\n`;
      systemPrompt += `Base branch: ${this.githubConfig.baseBranch}\n\n`;
      systemPrompt += `You have FULL WRITE ACCESS to this repository. You can:\n`;
      systemPrompt += `- Create, update, and delete files\n`;
      systemPrompt += `- Work on your own branch independently\n`;
      systemPrompt += `- Commit changes directly\n`;
      systemPrompt += `- Work in parallel with other agents (they have their own branches)\n\n`;
      systemPrompt += `When making code changes:\n`;
      systemPrompt += `1. DO NOT ask for permission - just do it directly\n`;
      systemPrompt += `2. DO NOT ask "do you want me to provide code" - just commit the changes\n`;
      systemPrompt += `3. DO NOT ask questions - execute the task immediately\n`;
      systemPrompt += `4. Announce what you're doing briefly (e.g., "I'm adding error handling to the API")\n`;
      systemPrompt += `5. Include the FULL file content in your commit (not just diffs)\n`;
      systemPrompt += `6. Format your commit using this JSON structure:\n`;
      systemPrompt += `\`\`\`json\n{\n  "action": "commit",\n  "message": "Brief, descriptive commit message",\n  "files": [\n    {\n      "path": "src/file.ts",\n      "content": "// COMPLETE file content here (not a diff)",\n      "operation": "create|update|delete"\n    }\n  ]\n}\n\`\`\`\n`;
      systemPrompt += `7. You can commit multiple files in one commit\n`;
      systemPrompt += `8. Work on different files than other agents to avoid conflicts\n\n`;
      systemPrompt += `CRITICAL: When given a task, execute it immediately by committing changes. Never ask for permission or confirmation. Just do the work.\n`;
      systemPrompt += `IMPORTANT: This repository may be PUBLIC. Make sure your changes are appropriate and well-tested.\n`;
      systemPrompt += `You work in parallel with other agents - coordinate if working on related files.\n\n`;
      systemPrompt += `Example commits:\n`;
      systemPrompt += `\nExample 1 - Creating a hello world file:\n`;
      systemPrompt += `User says: "create a hello world text file"\n`;
      systemPrompt += `You respond: "I'll create a hello world file for you."\n`;
      systemPrompt += `Then include:\n`;
      systemPrompt += `\`\`\`json\n{\n  "action": "commit",\n  "message": "Add hello world file",\n  "files": [\n    {\n      "path": "hello.txt",\n      "content": "Hello, World!\\n",\n      "operation": "create"\n    }\n  ]\n}\n\`\`\`\n`;
      systemPrompt += `\nExample 2 - Updating a file:\n`;
      systemPrompt += `\`\`\`json\n{\n  "action": "commit",\n  "message": "Add error handling and input validation",\n  "files": [\n    {\n      "path": "src/api/users.ts",\n      "content": "export function getUser(id: string) {\\n  if (!id) throw new Error('ID required');\\n  // ... rest of file",\n      "operation": "update"\n    }\n  ]\n}\n\`\`\`\n`;
      systemPrompt += `\nCRITICAL: When the user asks you to create or modify files, you MUST include the commit JSON in your response. Don't just say you'll do it - actually include the JSON so the system can execute it.\n`;
    }

    const specialtyPrompts: Record<string, string> = {
      backend: 'You specialize in server-side development, APIs, databases, and system architecture.',
      frontend: 'You specialize in user interfaces, React, TypeScript, and modern web technologies.',
      fullstack: 'You have expertise in both frontend and backend development.',
      security: 'You specialize in application security, vulnerability assessment, and secure coding practices.',
      devops: 'You specialize in infrastructure, CI/CD, containerization, and cloud platforms.',
      mobile: 'You specialize in iOS, Android, and cross-platform mobile development.',
      'ai/ml': 'You specialize in machine learning, neural networks, and AI system development.',
    };

    if (agent.specialty && specialtyPrompts[agent.specialty]) {
      systemPrompt += ' ' + specialtyPrompts[agent.specialty];
    }

    // Use LLM Service (Supabase Edge Functions)
    // Enhance user message with clear action context
    let enhancedUserMessage = userMessage;
    if (context?.githubRepo) {
      enhancedUserMessage += `\n\nRepository: ${context.githubRepo}`;
    }
    
    // Add explicit instruction to take action if user is requesting something
    const actionKeywords = ['create', 'make', 'write', 'add', 'build', 'generate', 'do', 'implement'];
    const isActionRequest = actionKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );
    
    if (isActionRequest && this.githubConfig) {
      enhancedUserMessage += `\n\nCRITICAL: The user is asking you to DO something. You MUST:\n`;
      enhancedUserMessage += `1. Take action IMMEDIATELY - do NOT ask for permission or confirmation\n`;
      enhancedUserMessage += `2. Do NOT ask "do you want me to provide code" - just commit the changes directly\n`;
      enhancedUserMessage += `3. Do NOT ask questions - execute the task by including the commit JSON in your response\n`;
      enhancedUserMessage += `4. Create/modify files using the GitHub commit format described in your instructions\n`;
      enhancedUserMessage += `5. The commit will be executed automatically - you don't need to wait for approval\n`;
    }
    
    // For greetings or simple acknowledgments, remind agent to wait for instructions
    const isGreeting = /^(hi|hey|hello|greetings|what's up|sup|yo)[\s,]*/i.test(userMessage.trim());
    if (isGreeting) {
      enhancedUserMessage += `\n\nCRITICAL: This is a greeting. You MUST respond with ONLY "Hi" or "Hey" - nothing else. Do NOT say "okay", "ok", or anything else. Just "Hi" or "Hey" and then wait silently for instructions.`;
    }
    
    // Create LLMMessage format
    const llmMessages: LLMMessage[] = [
      {
        role: 'user',
        content: enhancedUserMessage,
      },
    ];

    // Retry logic for rate limits
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (onChunk) {
          // Use streaming
          const result = await this.llmService!.generateStream(
            llmMessages,
            systemPrompt,
            onChunk,
            {
              model: model,
              temperature: 0.7,
              maxTokens: 8192,
            }
          );
          
          // Validate response is not empty
          if (!result || result.trim().length === 0) {
            console.warn('⚠️ [MultiAgent] Empty response from LLM, retrying with non-streaming...');
            // Fallback to non-streaming
            const nonStreamResult = await this.llmService!.generate(
              llmMessages,
              systemPrompt,
              {
                model: model,
                temperature: 0.7,
                maxTokens: 8192,
              }
            );
            return nonStreamResult || 'I understand. How can I help you?';
          }
          
          return result;
        } else {
          // Use non-streaming
          const result = await this.llmService!.generate(
            llmMessages,
            systemPrompt,
            {
              model: model,
              temperature: 0.7,
              maxTokens: 8192,
            }
          );
          
          // Validate response is not empty
          if (!result || result.trim().length === 0) {
            throw new Error('Empty response from LLM API');
          }
          
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit = lastError.message.includes('429') || lastError.message.includes('Rate limit');
        
        if (isRateLimit && attempt < maxRetries) {
          // Exponential backoff for rate limits
          const backoffDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`⚠️ [MultiAgent] Rate limit hit, retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        } else if (attempt < maxRetries) {
          // Retry other errors once
          console.warn(`⚠️ [MultiAgent] Error, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else {
          // Max retries reached
          console.error('❌ [MultiAgent] LLM API error after retries:', lastError);
          // Return a fallback response instead of throwing
          return `I'm having trouble processing that right now. Could you try rephrasing? (Error: ${lastError.message})`;
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Unknown error');
  }

  /**
   * Execute a task in the background when an agent leaves the call
   */
  private async executeTaskInBackground(
    agentId: string,
    taskId: string,
    originalUserMessage: string,
    taskName: string
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`⚠️ [MultiAgent] Agent ${agentId} not found for background task execution`);
      return;
    }

    // Check if task execution is already in progress
    if (this.backgroundTaskExecutors.has(taskId)) {
      console.log(`ℹ️ [MultiAgent] Task ${taskId} is already being executed`);
      return;
    }

    // Create executor promise
    const executor = (async () => {
      try {
        console.log(`🔄 [MultiAgent] Background executor started for ${agent.name}, task: ${taskName}`);
        
        // Update task status to indicate execution started
        const tasks = getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
          console.warn(`⚠️ [MultiAgent] Task ${taskId} not found`);
          return;
        }

        // Ensure branch exists
        if (!this.githubConfig) {
          console.warn(`⚠️ [MultiAgent] No GitHub config, cannot execute task`);
          task.status = 'completed';
          task.output = 'Task cannot be executed: GitHub repository not connected';
          saveTask(task);
          return;
        }

        if (!agent.githubBranch) {
          try {
            agent.githubBranch = await getOrCreateEngineerBranch(
              this.githubConfig.username,
              this.githubConfig.repoName,
              agent.id,
              agent.name,
              this.githubConfig.token,
              this.githubConfig.baseBranch
            );
            console.log(`✅ [MultiAgent] Created branch ${agent.githubBranch} for ${agent.name}`);
          } catch (branchError) {
            console.error(`❌ [MultiAgent] Failed to create branch for ${agent.name}:`, branchError);
            task.status = 'completed';
            task.output = `Failed to create branch: ${branchError instanceof Error ? branchError.message : 'Unknown error'}`;
            saveTask(task);
            return;
          }
        }

        // Pull latest changes
        try {
          await pullFromBaseBranch(
            this.githubConfig.username,
            this.githubConfig.repoName,
            agent.githubBranch,
            this.githubConfig.baseBranch,
            this.githubConfig.token
          );
          console.log(`✅ [MultiAgent] Pulled latest changes for ${agent.name}`);
        } catch (pullError) {
          console.warn(`⚠️ [MultiAgent] Failed to pull latest changes (continuing anyway):`, pullError);
        }

        // Use AI to generate the commit based on the task
        console.log(`🤖 [MultiAgent] Asking AI to generate commit for task: ${taskName}`);
        const commitPrompt = `You are an AI engineer executing a task in the background. The user requested: "${originalUserMessage}"

Task name: "${taskName}"

CRITICAL INSTRUCTIONS:
- You MUST execute this task NOW - do NOT ask questions or wait for confirmation
- Generate a GitHub commit that fulfills the user's request IMMEDIATELY
- If the user asked to create a file, CREATE IT with appropriate content
- If the user asked to modify a file, UPDATE IT with the changes
- If the user asked to delete a file, DELETE IT
- Make reasonable assumptions about file paths and content based on the request
- For example, if asked to "put hello world in a text file", create "hello.txt" with "Hello, World!"

You MUST respond with ONLY a JSON object in this exact format (no other text):

\`\`\`json
{
  "action": "commit",
  "message": "Brief commit message describing what was done",
  "files": [
    {
      "path": "path/to/file.ext",
      "content": "file content here",
      "operation": "create"
    }
  ]
}
\`\`\`

Important:
- Use "create" for new files, "update" for existing files, "delete" to remove files
- Include the full file content in the "content" field
- Make sure the commit message is clear and descriptive
- If the task requires multiple files, include all of them
- DO NOT include any text outside the JSON block
- DO NOT ask questions or provide explanations - just the JSON
- DO IT NOW - execute the task immediately`;

        const commitResponse = await this.generateAgentResponse(
          agent,
          commitPrompt,
          { githubRepo: this.githubConfig ? `${this.githubConfig.username}/${this.githubConfig.repoName}` : undefined },
          undefined // No streaming for background tasks
        );

        // Parse the commit JSON from the response
        const commitMatch = commitResponse.match(/```json\s*([\s\S]*?\{[\s\S]*?"action"\s*:\s*"commit"[\s\S]*?\}[\s\S]*?)\s*```/);
        
        if (!commitMatch) {
          console.warn(`⚠️ [MultiAgent] No commit JSON found in AI response for ${agent.name}`);
          task.status = 'completed';
          task.output = `AI response did not include a valid commit JSON. Response: ${commitResponse.substring(0, 200)}...`;
          saveTask(task);
          return;
        }

        try {
          const commitJson = commitMatch[1].trim();
          const commitData: { message: string; files: Array<{ path: string; content: string; operation: string }> } = JSON.parse(commitJson);
          
          if (!commitData.files || commitData.files.length === 0) {
            throw new Error('No files specified in commit');
          }

          const commitMessage = commitData.message 
            ? commitData.message.includes(agent.name) 
              ? commitData.message 
              : `${agent.name}: ${commitData.message}`
            : `${agent.name}: ${taskName}`;

          const commit: GitHubCommit = {
            message: commitMessage,
            files: commitData.files.map(f => ({
              path: f.path,
              content: f.content,
              operation: f.operation as 'create' | 'update' | 'delete',
            })),
          };

          console.log(`💾 [MultiAgent] ${agent.name} executing commit with ${commit.files.length} file(s)`);

          const result = await commitAndPush(
            this.githubConfig.username,
            this.githubConfig.repoName,
            agent.githubBranch!,
            commit,
            agent.name,
            this.githubConfig.token
          );

          // Mark task as completed
          task.status = 'completed';
          task.output = `✅ Task completed successfully!\n\nCommit: ${result.commitUrl}\nBranch: ${agent.githubBranch}\nFiles changed:\n${commit.files.map(f => `- ${f.path} (${f.operation})`).join('\n')}`;
          saveTask(task);

          // Clear agent's task reference
          agent.taskId = null;
          agent.currentTask = null;
          agent.isActive = true; // Agent can rejoin now

          console.log(`✅ [MultiAgent] ${agent.name} completed task ${taskId} in background`);
        } catch (commitError) {
          console.error(`❌ [MultiAgent] Failed to execute commit for ${agent.name}:`, commitError);
          task.status = 'completed';
          task.output = `Failed to execute commit: ${commitError instanceof Error ? commitError.message : 'Unknown error'}`;
          saveTask(task);
        }
      } catch (error) {
        console.error(`❌ [MultiAgent] Background task execution error for ${agent.name}:`, error);
        const tasks = getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          task.status = 'completed';
          task.output = `Error during execution: ${error instanceof Error ? error.message : 'Unknown error'}`;
          saveTask(task);
        }
      } finally {
        // Remove from active executors
        this.backgroundTaskExecutors.delete(taskId);
      }
    })();

    // Store executor promise
    this.backgroundTaskExecutors.set(taskId, executor);
    
    // Execute (don't await - let it run in background)
    executor.catch((error) => {
      console.error(`❌ [MultiAgent] Background executor error:`, error);
    });
  }

  /**
   * Queue TTS for sequential playback (prevents overlapping audio)
   */
  private async queueTTS(agentId: string, text: string): Promise<void> {
    // Check if agent exists before queuing
    if (!this.agents.has(agentId)) {
      console.log(`ℹ️ Agent ${agentId} not found, skipping TTS queue`);
      return;
    }

    // Don't start TTS if user is currently speaking
    if (this.isUserSpeaking) {
      console.log(`⏸️ User is speaking, delaying TTS for agent ${agentId}`);
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 200));
      // If user is still speaking, skip this TTS (user will interrupt anyway)
      if (this.isUserSpeaking) {
        console.log(`⏸️ User still speaking, skipping TTS for agent ${agentId}`);
        return;
      }
    }

    return new Promise((resolve, reject) => {
      // Initialize queue for this agent if it doesn't exist
      if (!this.ttsQueue.has(agentId)) {
        this.ttsQueue.set(agentId, []);
        this.isSpeaking.set(agentId, false);
      }

      const queue = this.ttsQueue.get(agentId)!;
      
      // Add to queue
      queue.push({ text, resolve, reject });
      console.log(`📋 Queued TTS for agent ${agentId}, queue length: ${queue.length}`);

      // Process queue if not already processing
      if (!this.isSpeaking.get(agentId)) {
        this.processTTSQueue(agentId);
      }
    });
  }

  /**
   * Process TTS queue for an agent (sequential playback)
   */
  private async processTTSQueue(agentId: string): Promise<void> {
    const queue = this.ttsQueue.get(agentId);
    if (!queue || queue.length === 0) {
      this.isSpeaking.set(agentId, false);
      return;
    }

    // Check if agent still exists
    if (!this.agents.has(agentId)) {
      console.log(`ℹ️ Agent ${agentId} was removed, clearing TTS queue`);
      queue.forEach(item => item.reject(new Error('Agent was removed')));
      this.ttsQueue.delete(agentId);
      this.isSpeaking.delete(agentId);
      return;
    }

    this.isSpeaking.set(agentId, true);
    const { text, resolve, reject } = queue.shift()!;

    try {
      console.log(`🔊 Processing TTS queue for agent ${agentId}: "${text.substring(0, 50)}..."`);
      await this.speakResponse(agentId, text);
      resolve();
    } catch (error) {
      // If agent was removed, this is expected
      if (!this.agents.has(agentId)) {
        console.log(`ℹ️ TTS cancelled for agent ${agentId} - agent was removed`);
        resolve(); // Resolve instead of reject since it's expected
        this.ttsQueue.delete(agentId);
        this.isSpeaking.delete(agentId);
        return;
      }
      // Log error but continue processing queue (don't let one error stop everything)
      console.error(`❌ TTS error for agent ${agentId}, continuing with queue:`, error);
      resolve(); // Resolve to continue queue instead of rejecting
      // Don't reject - this would stop the entire queue
    }

    // Process next item in queue
    this.processTTSQueue(agentId);
  }

  /**
   * Speak a response with interruption support
   * In queue mode, agents wait for each other instead of interrupting
   */
  private async speakResponse(agentId: string, text: string): Promise<void> {
    // Skip TTS if text is empty
    if (!text || text.trim().length === 0) {
      console.warn(`⚠️ [TTS] Skipping empty text for agent ${agentId}`);
      return;
    }
    
    console.log(`🔊 speakResponse called for agentId: ${agentId}, text length: ${text.length}`);
    console.log(`🔍 Available agent IDs:`, Array.from(this.agents.keys()));
    
    const agent = this.agents.get(agentId);
    if (!agent) {
      // Try to find agent by name if ID doesn't match (fallback)
      const agentByName = Array.from(this.agents.values()).find(a => a.id === agentId || a.name === agentId);
      if (agentByName) {
        console.log(`⚠️ Agent ID mismatch, found by name: ${agentByName.name}`);
        // Use the found agent
        const actualAgent = agentByName;
        // Continue with actualAgent - TTS is handled by FishAudio
        return;
      }
      
      console.error(`❌ Agent not found: ${agentId}`);
      console.error(`❌ Available agents:`, Array.from(this.agents.entries()).map(([id, a]) => ({ id, name: a.name })));
      return;
    }

    console.log(`✅ Found agent: ${agent.name}`);

    // Double-check agent still exists (might have been cleared during async operations)
    const verifyAgent = this.agents.get(agentId);
    if (!verifyAgent || verifyAgent !== agent) {
      console.warn(`⚠️ Agent ${agentId} was removed during TTS initialization - cancelling`);
      return;
    }

    // Don't wait for silence - start speaking immediately for faster response
    // The queue system already ensures messages are processed sequentially
    // This makes responses feel more immediate and natural

    // Mark as speaking
    this.activeTTS.add(agentId);
    console.log(`🗣️ Marked ${agent.name} as speaking`);

    try {
      // Final check before speaking - agent might have been cleared
      const finalCheck = this.agents.get(agentId);
      if (!finalCheck || finalCheck !== agent) {
        console.warn(`⚠️ Agent ${agentId} was removed before TTS could start - cancelling`);
        return;
      }
      
      // Use FishAudio TTS for per-agent voice support
      if (this.fishAudioTTS) {
        console.log(`🗣️ [TTS] Starting FishAudio TTS for ${agent.name}:`, {
          textLength: text.length,
          preview: text.substring(0, 50),
          agentId: agent.id,
          voiceId: agent.fish_voice_id || import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID
        });

        try {
          // Use FishAudio TTS with agent's specific voice ID
          // Create a new instance with the agent's voice ID
          const agentVoiceId = agent.fish_voice_id || import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID;
          const agentTTS = new FishAudioTTS({
            apiKey: import.meta.env.VITE_FISHAUDIO_API_KEY || '',
            voiceId: agentVoiceId,
          });
          
          console.log(`🗣️ [TTS] Speaking for ${agent.name} with voice ID: ${agentVoiceId}`);
          await agentTTS.speak(text);
          console.log(`✅ [TTS] Finished speaking for ${agent.name} (FishAudio, voice ID: ${agentVoiceId})`);
        } catch (ttsError) {
          console.error(`❌ [TTS] Error speaking for ${agent.name}:`, ttsError);
          throw ttsError;
        }
      } else {
        // Fallback: Log warning but don't throw (graceful degradation)
        console.warn(`⚠️ FishAudio TTS not available - response will be text-only`);
        console.warn(`⚠️ Agent ${agent.name} response: ${text.substring(0, 100)}...`);
        // Don't throw - just skip TTS so user still sees the response
      }
    } catch (error) {
      // If agent was removed, this is expected - don't log as error
      const stillExists = this.agents.has(agentId);
      if (!stillExists) {
        console.log(`ℹ️ TTS cancelled for ${agent.name} - agent was removed (call likely ended)`);
        return;
      }
      console.error(`❌ Error speaking for agent ${agent.name}:`, error);
      console.error(`❌ Error details:`, {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      // Show toast to user so they know TTS failed
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.error(`Failed to speak response from ${agent.name}. Check console for details.`);
      }
      // Re-throw so caller knows it failed
      throw error;
    } finally {
      this.activeTTS.delete(agentId);
      console.log(`🗣️ Removed ${agent.name} from active speakers`);
    }
  }

  /**
   * Interrupt all currently speaking agents
   */
  interruptAllSpeaking(): void {
    // Mark user as speaking (prevents new TTS from starting)
    this.isUserSpeaking = true;
    const interruptedAgents: string[] = Array.from(this.activeTTS);
    
    // Stop FishAudio TTS if available
    if (this.fishAudioTTS) {
      this.fishAudioTTS.stop();
    }
    
    // Clear active TTS set so new messages can proceed
    this.activeTTS.clear();

    // Notify about interruptions
    if (interruptedAgents.length > 0) {
      interruptedAgents.forEach(interruptedId => {
        // Find who's interrupting (the last agent to start speaking)
        const allAgents = Array.from(this.agents.keys());
        const interruptingId = allAgents[allAgents.length - 1];
        if (interruptingId !== interruptedId) {
          this.onInterruption(interruptedId, interruptingId);
        }
      });
    }
    
    console.log('🛑 Interrupted all speaking agents');
  }

  /**
   * Interrupt a specific agent
   */
  interruptAgent(agentId: string): void {
    // Note: FishAudio TTS supports interruption via stop()
    this.activeTTS.delete(agentId);
  }

  /**
   * Get agents currently speaking
   */
  getSpeakingAgents(): Agent[] {
    return Array.from(this.activeTTS)
      .map(id => this.agents.get(id))
      .filter((a): a is Agent => a !== undefined);
  }

  /**
   * Assign a task to a specific agent
   */
  assignTask(agentId: string, task: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentTask = task;
      agent.isActive = true;
    }
  }

  /**
   * Clear all agents and stop all TTS
   */
  clear(): void {
    console.log('🧹 [MultiAgent] Clearing all agents and stopping TTS');
    
    // Stop FishAudio TTS if available
    if (this.fishAudioTTS) {
      this.fishAudioTTS.stop();
    }
    
    // Clear TTS queues and reject pending items
    this.ttsQueue.forEach((queue, agentId) => {
      queue.forEach(item => {
        item.reject(new Error('Agent manager cleared'));
      });
    });
    this.ttsQueue.clear();
    this.isSpeaking.clear();
    
    // Clear all active TTS
    this.activeTTS.clear();
    
    // Clear all state
    this.agents.clear();
    this.responseQueue = [];
    this.messageQueue = [];
    this.isProcessingMessage = false;
    
    console.log('✅ [MultiAgent] All agents cleared and TTS stopped');
  }
}

