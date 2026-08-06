const DISCORD_FILE_LIMIT = 25 * 1024 * 1024
const SAFETY_MARGIN = 0.8

const PER_FILE_LIMITS = {
	image: 0.3,
	video: 0.15,
	audio: 0.1,
} as const

interface MappedAttachment {
	name: string
	url: string
	size: number
	sizeFormatted: string
	extension: string
	width?: number | null
	height?: number | null
	hasDimensions: boolean
	isImage: boolean
	isVideo: boolean
	isAudio: boolean
	isGif: boolean
	isFile: boolean
	isSpoiler: boolean
}

interface EmbedResult<T> {
	messages: T[]
	totalEmbeddedSize: number
	embeddedCount: number
	skippedCount: number
}

async function getContentLength(url: string): Promise<number | null> {
	try {
		const response = await fetch(url, { method: 'HEAD' })
		const contentLength = response.headers.get('content-length')
		return contentLength ? Number.parseInt(contentLength, 10) : null
	} catch {
		return null
	}
}

async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
	try {
		const response = await fetch(url)
		if (!response.ok) return null

		const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
		const buffer = await response.arrayBuffer()
		const base64 = Buffer.from(buffer).toString('base64')

		return { base64, mimeType: contentType.split(';')[0].trim() }
	} catch {
		return null
	}
}

function getMediaType(attachment: MappedAttachment): 'image' | 'video' | 'audio' | null {
	if (attachment.isImage) return 'image'
	if (attachment.isVideo) return 'video'
	if (attachment.isAudio) return 'audio'
	return null
}

function canEmbed(
	attachment: MappedAttachment,
	currentSize: number,
	targetSize: number,
): boolean {
	const mediaType = getMediaType(attachment)
	if (!mediaType) return false

	if (currentSize >= targetSize) return false

	const perFileLimit = targetSize * PER_FILE_LIMITS[mediaType]
	if (attachment.size > perFileLimit) return false
	if (attachment.size > targetSize - currentSize) return false

	return true
}

export async function embedMedia<T extends { attachments: MappedAttachment[]; [key: string]: any }>(
	messages: T[],
	maxFileSize: number = DISCORD_FILE_LIMIT,
): Promise<EmbedResult<T>> {
	const targetSize = maxFileSize * SAFETY_MARGIN
	let accumulatedSize = 0
	let embeddedCount = 0
	let skippedCount = 0

	const processedMessages = await Promise.all(
		messages.map(async (msg) => {
			if (!msg.attachments || msg.attachments.length === 0) return msg

			const processedAttachments = await Promise.all(
				msg.attachments.map(async (attachment) => {
					if (!canEmbed(attachment, accumulatedSize, targetSize)) {
						skippedCount++
						return attachment
					}

					const contentLength = await getContentLength(attachment.url)
					if (contentLength !== null) {
						if (contentLength + accumulatedSize > targetSize) {
							skippedCount++
							return attachment
						}
					}

					const result = await fetchAsBase64(attachment.url)
					if (!result) {
						skippedCount++
						return attachment
					}

					const dataUri = `data:${result.mimeType};base64,${result.base64}`
					const embeddedSize = contentLength ?? Math.ceil(result.base64.length * 0.75)
					accumulatedSize += embeddedSize
					embeddedCount++

					return {
						...attachment,
						url: dataUri,
						embedded: true,
					}
				}),
			)

			return {
				...msg,
				attachments: processedAttachments,
			}
		}),
	)

	return {
		messages: processedMessages,
		totalEmbeddedSize: accumulatedSize,
		embeddedCount,
		skippedCount,
	}
}
