// src/types/index.d.ts

declare namespace KnuggetAI {
  // User information
  interface UserInfo {
    id: string;
    name: string;
    email: string;
    token: string;
    expiresAt: number;
    plan: string;
    credits: number;
    imageUrl?: string;
  }
  
  // Summary information
  interface Summary {
    id?: string;
    title: string;
    keyPoints: string[];
    fullSummary: string;
    videoUrl?: string;
    videoId?: string;
    createdAt?: string;
    updatedAt?: string;
  }
  
  // Message structure for internal extension communication
  interface Message {
    type: string;
    payload?: any;
  }
  
  // Transcript segment structure
  interface TranscriptSegment {
    timestamp: string;
    text: string;
    start?: number;
    duration?: number;
  }
  
  // Video metadata
  interface VideoMetadata {
    videoId: string;
    title: string;
    channelName?: string;
    publishDate?: string;
    duration?: number;
    url: string;
  }

  // API response structure
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
  }

  // Auth credentials
  interface Credentials {
    email: string;
    password: string;
  }

  // Registration data
  interface RegistrationData extends Credentials {
    name: string;
  }
}