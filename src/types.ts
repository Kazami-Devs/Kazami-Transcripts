import type { TextBasedChannel } from 'discord.js'

export interface TranscriptOptions {
  guildName?: string
  locale?: string
  timezone?: string
  limit?: number
  returnType?: 'string' | 'buffer'
}

export interface TranscriptResult {
  fileName: string
  html: string | Buffer
}

export type CreateTranscriptFunction = (
  channel: TextBasedChannel,
  options?: TranscriptOptions
) => Promise<TranscriptResult>
