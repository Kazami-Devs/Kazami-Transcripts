import type { TextBasedChannel } from 'discord.js'

export type MediaType = 'image' | 'video'

export interface TranscriptOptions {
	guildName?: string
	locale?: string
	timezone?: string
	limit?: number
	returnType?: 'string' | 'buffer'
	embedMedia?: boolean
	embedTypes?: MediaType[]
	maxFileSize?: number
}

export interface TranscriptResult {
	fileName: string
	html: string | Buffer
}

export type CreateTranscriptFunction = (
	channel: TextBasedChannel,
	options?: TranscriptOptions,
) => Promise<TranscriptResult>
