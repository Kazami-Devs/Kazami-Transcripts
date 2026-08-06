import fs from 'node:fs'
import path from 'node:path'
import type { Message, TextBasedChannel } from 'discord.js'
import Mustache from 'mustache'
import { embedMedia } from './embedMedia'
import { mapMessage, mapReplyPreview } from './mapMessage'
import type { TranscriptOptions, TranscriptResult } from './types'

const template = fs.readFileSync(path.join(__dirname, 'assets', 'transcript.md.mustache'), 'utf-8')

export async function createTranscript(
	channel: TextBasedChannel,

	options: TranscriptOptions = {},
): Promise<TranscriptResult> {
	if (channel.isDMBased()) throw new Error('DM channels are not supported')

	const {
		guildName = 'Unknown Guild',
		locale = 'en-US',
		timezone = 'UTC',
		limit = 100,
		returnType = 'string',
		embedMedia: shouldEmbedMedia = false,
		maxFileSize = 25 * 1024 * 1024,
	} = options
	const fileName = `transcript-${channel.name}.html`

	let allMessages: Message[] = []
	let lastId: string | undefined

	if (limit === -1) {
		while (true) {
			const fetchOptions: any = { limit: 100 }
			if (lastId) fetchOptions.before = lastId

			const fetchedMessages: any = await channel.messages.fetch(fetchOptions)
			if (!fetchedMessages.size) break

			allMessages = [...allMessages, ...fetchedMessages.values()]
			lastId = fetchedMessages.last()?.id
		}
	} else {
		while (allMessages.length < limit) {
			const remainingMessages = limit - allMessages.length
			const fetchLimit = Math.min(remainingMessages, 100)

			const fetchOptions: any = { limit: fetchLimit }
			if (lastId) fetchOptions.before = lastId

			const fetchedMessages: any = await channel.messages.fetch(fetchOptions)
			if (!fetchedMessages.size) break

			allMessages = [...allMessages, ...fetchedMessages.values()]
			lastId = fetchedMessages.last()?.id

			if (allMessages.length >= limit) {
				allMessages = allMessages.slice(0, limit)
				break
			}
		}
	}

	const formatDate = (date: Date) =>
		new Intl.DateTimeFormat(locale, {
			dateStyle: 'short',
			timeStyle: 'short',
			timeZone: timezone,
		}).format(date)

	const formatTime = (date: Date) =>
		new Intl.DateTimeFormat(locale, {
			timeStyle: 'short',
			timeZone: timezone,
		}).format(date)

	const formatDateLong = (date: Date) =>
		new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: timezone,
		}).format(date)

	const messagesById = new Map(allMessages.map((message) => [message.id, message]))
	const GROUP_MS = 7 * 60 * 1000

	const chronological = [...allMessages].reverse()
	let mappedMessages = chronological.map((message) =>
		mapMessage(message, formatDate, formatTime),
	)

	type EnrichedMessage = ReturnType<typeof mapMessage> & {
		showDateDivider: boolean
		dateDividerLabel: string | null
		showHeader: boolean
		isCompact: boolean
		showInteraction: boolean
		isInteractionContinuation: boolean
		replyTo: ReturnType<typeof mapReplyPreview> | null
	}

	const enrichedMessages: EnrichedMessage[] = []
	for (let index = 0; index < mappedMessages.length; index++) {
		const msg = mappedMessages[index]
		const prev = index > 0 ? enrichedMessages[index - 1] : null
		const raw = messagesById.get(msg.messageId)!
		const rawPrev = prev ? messagesById.get(prev.messageId) : null

		const showDateDivider = !prev || prev.dateKey !== msg.dateKey
		const dateDividerLabel = showDateDivider ? formatDateLong(raw.createdAt) : null

		let showHeader = true
		let isCompact = false
		if (!msg.isSystemMessage && prev && !prev.isSystemMessage) {
			const sameAuthor = prev.author === msg.author
			const timeDiff = raw.createdAt.getTime() - (rawPrev?.createdAt.getTime() ?? 0)
			const canGroup =
				sameAuthor &&
				timeDiff <= GROUP_MS &&
				!prev.isCommand &&
				!msg.isCommand
			if (canGroup) {
				showHeader = false
				isCompact = true
			}
		}

		let showInteraction = msg.isCommand
		let isInteractionContinuation = false
		let commandName = msg.commandName
		let commandUser = msg.commandUser
		let commandUserAvatar = msg.commandUserAvatar
		let commandUserColor = msg.commandUserColor

		if (
			!showInteraction &&
			isCompact &&
			prev?.showInteraction &&
			msg.isBot &&
			prev.isBot &&
			prev.author === msg.author
		) {
			showInteraction = true
			isInteractionContinuation = true
			commandName = prev.commandName
			commandUser = prev.commandUser
			commandUserAvatar = prev.commandUserAvatar
			commandUserColor = prev.commandUserColor
		}

		const refId = raw.reference?.messageId
		const refMessage = refId ? messagesById.get(refId) : undefined
		const replyTo =
			refMessage && !showInteraction ? mapReplyPreview(refMessage) : null

		if (showInteraction || msg.isCommand) {
			showHeader = true
			isCompact = false
			if (msg.isCommand) {
				isInteractionContinuation = false
			}
		}

		enrichedMessages.push({
			...msg,
			showDateDivider,
			dateDividerLabel,
			showHeader,
			isCompact,
			showInteraction,
			isInteractionContinuation,
			commandName,
			commandUser,
			commandUserAvatar,
			commandUserColor,
			replyTo,
		})
	}
	mappedMessages = enrichedMessages

	if (shouldEmbedMedia) {
		const embedResult = await embedMedia(mappedMessages, maxFileSize)
		mappedMessages = embedResult.messages
	}

	const nonSystemMessages = mappedMessages.filter((msg) => !msg.isSystemMessage)
	const messageCount = nonSystemMessages.length
	const participantCount = new Set(nonSystemMessages.map((msg) => msg.author)).size
	const firstMapped = nonSystemMessages[0]
	const lastMapped = nonSystemMessages.at(-1)
	const firstMessageAt = firstMapped
		? formatDate(messagesById.get(firstMapped.messageId)!.createdAt)
		: null
	const lastMessageAt = lastMapped
		? formatDate(messagesById.get(lastMapped.messageId)!.createdAt)
		: null

	const guild = channel.guild
	const guildIconUrl = guild?.iconURL({ extension: 'png', size: 128 }) ?? null
	const guildInitial = guildName.trim().charAt(0).toUpperCase() || '?'

	const renderData = {
		channelName: channel.name,
		guildName,
		guildIconUrl,
		hasGuildIcon: Boolean(guildIconUrl),
		guildInitial,
		createdAtFull: formatDate(new Date()),
		closedAtFull: formatDate(new Date()),
		messageCount,
		participantCount,
		firstMessageAt,
		lastMessageAt,
		hasMessageRange: Boolean(
			firstMessageAt &&
				lastMessageAt &&
				firstMapped?.messageId !== lastMapped?.messageId,
		),
		messages: mappedMessages,
	}

	const html = Mustache.render(template, renderData)

	return { fileName, html: returnType === 'buffer' ? Buffer.from(html) : html }
}
