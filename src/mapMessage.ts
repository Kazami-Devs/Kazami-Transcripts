import type { Embed, Message } from 'discord.js'
import { MessageType } from 'discord.js'

interface InteractionInfo {
	commandName: string
	commandUser: string
	commandUserAvatar: string
	commandUserColor: string | null
}

function getInteractionInfo(message: Message): InteractionInfo | null {
	if (message.interaction) {
		const user = message.interaction.user
		const member = message.guild?.members.cache.get(user.id)
		const memberColor = member?.displayHexColor
		return {
			commandName: message.interaction.commandName,
			commandUser: user.username,
			commandUserAvatar: user.displayAvatarURL({ extension: 'png', size: 32 }),
			commandUserColor: memberColor && memberColor !== '#000000' ? memberColor : null,
		}
	}

	const meta = (
		message as Message & {
			interactionMetadata?: {
				name?: string
				user?: {
					id: string
					username: string
					displayAvatarURL?: (options: object) => string
				}
			}
		}
	).interactionMetadata

	if (meta?.user && meta.name) {
		const user = meta.user
		const member = message.guild?.members.cache.get(user.id)
		const memberColor = member?.displayHexColor
		const avatarUrl =
			typeof user.displayAvatarURL === 'function'
				? user.displayAvatarURL({ extension: 'png', size: 32 })
				: `https://cdn.discordapp.com/embed/avatars/${Number(user.id) % 5}.png`

		return {
			commandName: meta.name,
			commandUser: user.username,
			commandUserAvatar: avatarUrl,
			commandUserColor: memberColor && memberColor !== '#000000' ? memberColor : null,
		}
	}

	return null
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileExtension(name: string): string {
	const lastDot = name.lastIndexOf('.')
	if (lastDot < 0) return 'FILE'
	const ext = name.slice(lastDot + 1).toUpperCase()
	return ext.length <= 5 ? ext : 'FILE'
}

function isImageAttachment(name: string, contentType?: string | null): boolean {
	if (contentType?.startsWith('image/')) return true
	return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(name)
}

function isVideoAttachment(name: string, contentType?: string | null): boolean {
	if (contentType?.startsWith('video/')) return true
	return /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name)
}

function isAudioAttachment(name: string, contentType?: string | null): boolean {
	if (contentType?.startsWith('audio/')) return true
	return /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(name)
}

const MIME_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	bmp: 'image/bmp',
	svg: 'image/svg+xml',
	avif: 'image/avif',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime',
	mkv: 'video/x-matroska',
	avi: 'video/x-msvideo',
	m4v: 'video/x-m4v',
}

const MARKDOWN_PLACEHOLDER = '\uE000MD'

function formatDiscordEmojis(text: string): string {
	return text.replace(
		/&lt;(a)?:([\w~]+):(\d+)&gt;/gi,
		(_match, animated: string | undefined, name: string, id: string) => {
			const ext = animated ? 'gif' : 'png'
			const safeName = escapeHtml(name)
			return `<img class="dc-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${safeName}:" title=":${safeName}:" draggable="false" loading="lazy">`
		},
	)
}

const IMAGE_URL_PATTERN =
	/https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp|avif|svg)(?:\?[^\s<>"']*)?/i

function formatInlineImages(text: string): string {
	text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, alt, url) => {
		const safeAlt = escapeHtml(alt || 'Image')
		const safeUrl = escapeHtml(url)
		return `<span class="dc-media dc-media--image dc-media--external"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl}" alt="${safeAlt}" loading="lazy" referrerpolicy="no-referrer"></a></span>`
	})

	return text.replace(
		/(?<!href="|src="|">)(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp|avif|svg)(?:\?[^\s<>"']*)?)/gi,
		(url) => {
			const safeUrl = escapeHtml(url)
			return `<span class="dc-media dc-media--image dc-media--external"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl}" alt="Image" loading="lazy" referrerpolicy="no-referrer"></a></span>`
		},
	)
}

function formatDiscordMarkdown(text: string): string {
	if (!text) return ''

	const saved: string[] = []
	const save = (html: string) => {
		saved.push(html)
		return `${MARKDOWN_PLACEHOLDER}${saved.length - 1}${MARKDOWN_PLACEHOLDER}`
	}

	text = text.replace(/```(?:(\w+)\n)?([\s\S]*?)```/g, (_match, _lang, code) =>
		save(`<pre class="dc-code-block"><code>${code}</code></pre>`),
	)

	text = text.replace(/`([^`]+?)`/g, (_match, code) =>
		save(`<code class="dc-code-inline">${code}</code>`),
	)

	text = formatDiscordEmojis(text)
	text = formatInlineImages(text)

	text = text.replace(/\|\|(.+?)\|\|/g, '<span class="dc-spoiler">$1</span>')
	text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
	text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
	text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
	text = text.replace(/__(.+?)__/g, '<u>$1</u>')
	text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
	text = text.replace(/_(.+?)_/g, '<em>$1</em>')
	text = text.replace(/~~(.+?)~~/g, '<del>$1</del>')
	text = text.replace(/^&gt;\s?(.+)$/gm, '<blockquote class="dc-quote">$1</blockquote>')
	text = text.replace(/^#\s(.+)$/gm, '<h1 class="dc-header-1">$1</h1>')
	text = text.replace(/^##\s(.+)$/gm, '<h2 class="dc-header-2">$1</h2>')
	text = text.replace(/^###\s(.+)$/gm, '<h3 class="dc-header-3">$1</h3>')
	text = text.replace(/^-#\s(.+)$/gm, '<div class="dc-list-item-small">$1</div>')
	text = text.replace(/^-\s(.+)$/gm, '<div class="dc-list-item">• $1</div>')
	text = text.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (_match, timestamp, _format) => {
		const date = new Date(parseInt(timestamp, 10) * 1000)
		return `<span class="dc-timestamp">${date.toLocaleString()}</span>`
	})
	text = text.replace(
		/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g,
		'<a href="$2" class="dc-link" target="_blank" rel="noopener noreferrer">$1</a>',
	)
	text = text.replace(/(?<!href="|src="|">)(https?:\/\/[^\s<]+)/g, (url) => {
		if (IMAGE_URL_PATTERN.test(url)) return url
		return `<a href="${url}" class="dc-link" target="_blank" rel="noopener noreferrer">${url}</a>`
	})

	text = text.replace(
		new RegExp(`${MARKDOWN_PLACEHOLDER}(\\d+)${MARKDOWN_PLACEHOLDER}`, 'g'),
		(_match, index) => saved[Number(index)] ?? '',
	)

	return text
}

function formatContent(content: string, message: Message): string {
	if (!content) return ''

	let formattedContent = escapeHtml(content)

	formattedContent = formattedContent.replace(/&lt;@!?(\d+)&gt;/g, (_match, userId) => {
		const user = message.mentions.users.get(userId)
		const username = user ? escapeHtml(user.username) : 'Unknown User'
		return `<span class="dc-mention">@${username}</span>`
	})

	formattedContent = formattedContent.replace(/&lt;@&amp;(\d+)&gt;/g, (_match, roleId) => {
		const role = message.guild?.roles.cache.get(roleId)
		const roleName = role ? escapeHtml(role.name) : 'Unknown Role'
		const roleColor = role?.color ? role.color.toString(16).padStart(6, '0') : '5865f2'
		return `<span class="dc-mention dc-mention-role" style="--dc-mention-color-rgb: ${parseInt(roleColor.slice(0, 2), 16)} ${parseInt(roleColor.slice(2, 4), 16)} ${parseInt(roleColor.slice(4, 6), 16)}">@${roleName}</span>`
	})

	formattedContent = formattedContent.replace(/&lt;#(\d+)&gt;/g, (_match, channelId) => {
		const channel = message.guild?.channels.cache.get(channelId)
		const channelName = channel ? escapeHtml(channel.name) : 'Unknown Channel'
		return `<span class="dc-mention">#${channelName}</span>`
	})

	formattedContent = formatDiscordMarkdown(formattedContent)

	return formattedContent
}

function getSystemMessageText(message: Message): string | null {
	const author = escapeHtml(message.author.username)

	switch (message.type) {
		case MessageType.RecipientAdd:
			if (message.mentions.users.size > 0) {
				const addedUser = escapeHtml(message.mentions.users.first()?.username)
				return `${author} added ${addedUser} to the thread.`
			}
			return `${author} added someone to the thread.`

		case MessageType.RecipientRemove:
			if (message.mentions.users.size > 0) {
				const removedUser = escapeHtml(message.mentions.users.first()?.username)
				return `${author} removed ${removedUser} from the thread.`
			}
			return `${author} removed someone from the thread.`

		case MessageType.Call:
			return `${author} started a call.`

		case MessageType.ChannelNameChange:
			return `${author} changed the channel name: ${escapeHtml(message.content)}`

		case MessageType.ChannelIconChange:
			return `${author} changed the channel icon.`

		case MessageType.ChannelPinnedMessage:
			return `${author} pinned a message to this channel.`

		case MessageType.UserJoin:
			return `${author} joined the server.`

		case MessageType.GuildBoost:
			return `${author} just boosted the server!`

		case MessageType.GuildBoostTier1:
			return `${author} just boosted the server! The server has achieved Level 1!`

		case MessageType.GuildBoostTier2:
			return `${author} just boosted the server! The server has achieved Level 2!`

		case MessageType.GuildBoostTier3:
			return `${author} just boosted the server! The server has achieved Level 3!`

		case MessageType.ChannelFollowAdd:
			return `${author} has added ${escapeHtml(message.content)} to this channel.`

		case MessageType.ThreadCreated:
			return `${author} started a thread: ${escapeHtml(message.content)}`

		case MessageType.Reply:
			return null

		case MessageType.ChatInputCommand:
			return null

		case MessageType.ThreadStarterMessage:
			return null

		case MessageType.ContextMenuCommand:
			return null

		case MessageType.AutoModerationAction:
			return `AutoMod flagged a message.`

		default:
			return null
	}
}

function mapComponents(components: any[], message: Message): any[] {
	if (!components || !Array.isArray(components)) return []

	return components.map((rawComponent) => {
		const component =
			typeof rawComponent?.toJSON === 'function' ? rawComponent.toJSON() : rawComponent
		const mapped: any = {
			type: component.type,
			id: component.id,
			isText: component.type === 10,
			isContainer: component.type === 17,
			isSeparator: component.type === 14,
			isActionRow: component.type === 1,
			isButton: component.type === 2,
			isSection: component.type === 9,
			isThumbnail: component.type === 11,
		}

		if (component.type === 10) {
			mapped.content = formatContent(component.content || '', message)
		}

		if (component.type === 17) {
			mapped.accentColor = component.accent_color
				? `#${component.accent_color.toString(16).padStart(6, '0')}`
				: null
			mapped.spoiler = component.spoiler || false
			mapped.components = mapComponents(component.components || [], message)
		}

		if (component.type === 14) {
			mapped.spacing = component.spacing || 0
			mapped.divider = component.divider || false
		}

		if (component.type === 1) {
			mapped.components = mapComponents(component.components || [], message)
		}

		if (component.type === 2) {
			mapped.customId = component.custom_id
			mapped.style = component.style
			mapped.label = component.label
			mapped.disabled = component.disabled || false
			mapped.emoji = component.emoji
				? {
						id: component.emoji.id,
						name: component.emoji.name,
						animated: component.emoji.animated || false,
					}
				: null
			mapped.url = component.url || null
		}
		if (component.type === 9) {
			mapped.components = mapComponents(component.components || [], message)
			mapped.accessory = component.accessory
				? mapComponents([component.accessory], message)[0]
				: null
		}
		if (component.type === 11) {
			mapped.url = component.media?.url || component.url || component.proxy_url || null
			mapped.alt = component.alt || null
		}

		return mapped
	})
}

export function mapReplyPreview(message: Message) {
	const snippet = message.content?.trim() ?? ''
	const hasAttachment = message.attachments.size > 0
	const hasEmbed = message.embeds.length > 0

	return {
		author: message.author.username,
		avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 32 }),
		content: snippet ? formatContent(snippet.slice(0, 140), message) : null,
		hasContent: Boolean(snippet),
		hasAttachment: !snippet && hasAttachment,
		hasEmbed: !snippet && !hasAttachment && hasEmbed,
	}
}

export function mapMessage(
	message: Message,
	formatDate: (date: Date) => string,
	formatTime: (date: Date) => string,
) {
	const formatEmbedText = (text?: string | null) => (text ? formatContent(text, message) : null)
	const formatEmbedFieldText = (text?: string | null) => (text ? formatContent(text, message) : '')

	const embeds = message.embeds.map((embed: Embed) => {
		const hasFields = (embed.fields?.length ?? 0) > 0
		const hasText = Boolean(
			embed.title || embed.description || embed.author?.name || embed.footer?.text,
		)
		const embedImage = embed.image?.url ?? null
		const embedThumbnail = embed.thumbnail?.url ?? null
		const isImageOnly = Boolean(!hasText && !hasFields && (embedImage || embedThumbnail))
		const image = embedImage ?? (isImageOnly ? embedThumbnail : null)
		const thumbnail = isImageOnly ? null : embedThumbnail

		return {
			title: formatEmbedText(embed.title),
			description: formatEmbedText(embed.description),
			color: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#7289da',
			fields:
				embed.fields?.map((field) => ({
					name: formatEmbedFieldText(field.name),
					value: formatEmbedFieldText(field.value),
					inline: field.inline,
				})) ?? [],
			image,
			thumbnail,
			author: formatEmbedText(embed.author?.name),
			footer: formatEmbedText(embed.footer?.text),
			url: embed.url,
			isImageOnly,
		}
	})

	const attachments = message.attachments.map((attachment) => {
		const name = attachment.name ?? 'file'
		const contentType = attachment.contentType ?? null
		const isImage = isImageAttachment(name, contentType)
		const isVideo = isVideoAttachment(name, contentType)
		const isAudio = isAudioAttachment(name, contentType)
		const isGif = contentType === 'image/gif' || name.toLowerCase().endsWith('.gif')
		const isFile = !isImage && !isVideo && !isAudio
		const ext = getFileExtension(name).toLowerCase()
		const mimeType =
			contentType?.split(';')[0].trim() ?? MIME_TYPES[ext] ?? 'application/octet-stream'

		return {
			name,
			url: attachment.proxyURL ?? attachment.url,
			size: attachment.size,
			sizeFormatted: formatFileSize(attachment.size),
			extension: getFileExtension(name),
			mimeType,
			width: attachment.width,
			height: attachment.height,
			hasDimensions: Boolean(attachment.width && attachment.height),
			isImage,
			isVideo,
			isAudio,
			isGif,
			isFile,
			isSpoiler: attachment.spoiler ?? false,
		}
	})

	const stickers = message.stickers.map((sticker) => ({
		name: sticker.name,
		url: sticker.url,
		format: sticker.format,
	}))

	const tenorGifs: string[] = []
	const regularEmbeds = embeds.filter((embed) => {
		const isTenorEmbed =
			(embed.url && (embed.url.includes('tenor.com') || embed.url.includes('media.tenor.com'))) ||
			(embed.image &&
				(embed.image.includes('tenor.com') ||
					embed.image.includes('media.tenor.com') ||
					embed.image.includes('tenor.gif'))) ||
			(embed.thumbnail &&
				(embed.thumbnail.includes('tenor.com') ||
					embed.thumbnail.includes('media.tenor.com') ||
					embed.thumbnail.includes('tenor.gif')))

		if (isTenorEmbed) {
			const gifUrl = embed.image || embed.thumbnail
			if (gifUrl) {
				tenorGifs.push(gifUrl)
			}
			return false
		}
		return true
	})

	const contentTrimmed = message.content?.trim() ?? ''
	const tenorUrlRegex = /^https?:\/\/(www\.)?tenor\.com\/view\/[^\s]+$/
	const isOnlyTenorUrl = tenorUrlRegex.test(contentTrimmed)

	let processedContent = isOnlyTenorUrl ? null : formatContent(message.content ?? '', message)

	if (processedContent) {
		const trimmed = message.content?.trim() ?? ''
		const single = attachments.length === 1 ? attachments[0] : null
		const imageEmbed = embeds.find((embed) => embed.isImageOnly && embed.image)

		if (
			single?.isImage &&
			(trimmed === single.url ||
				trimmed === `<${single.url}>` ||
				trimmed === (message.attachments.first()?.url ?? ''))
		) {
			processedContent = null
		} else if (
			imageEmbed?.image &&
			(trimmed === imageEmbed.image || trimmed === `<${imageEmbed.image}>`)
		) {
			processedContent = null
		}
	}

	const systemMessageText = getSystemMessageText(message)
	const isSystemMessage = systemMessageText !== null

	const memberColor = message.member?.displayHexColor
	const authorColor = memberColor && memberColor !== '#000000' ? memberColor : null

	const isBot = message.author.bot
	const isApp = Boolean(message.author.bot && message.applicationId)
	const interaction = getInteractionInfo(message)
	const isCommand = interaction !== null
	const commandName = interaction?.commandName ?? null
	const commandUser = interaction?.commandUser ?? null
	const commandUserAvatar = interaction?.commandUserAvatar ?? null
	const commandUserColor = interaction?.commandUserColor ?? null

	const components = mapComponents(message.components as any, message)

	return {
		messageId: message.id,
		author: message.author.username,
		authorColor,
		avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
		content: processedContent,
		timestamp: formatDate(message.createdAt),
		shortTimestamp: formatTime(message.createdAt),
		dateKey: message.createdAt.toISOString().slice(0, 10),
		embeds: regularEmbeds,
		attachments,
		stickers,
		tenorGifs,
		hasEmbeds: regularEmbeds.length > 0,
		hasAttachments: attachments.length > 0,
		hasStickers: stickers.length > 0,
		hasTenorGifs: tenorGifs.length > 0,
		isBot,
		isApp,
		isCommand,
		commandName,
		commandUser,
		commandUserAvatar,
		commandUserColor,
		isSystemMessage,
		systemMessageText,
		components,
		hasComponents: components.length > 0,
	}
}
