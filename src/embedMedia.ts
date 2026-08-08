const DISCORD_FILE_LIMIT = 25 * 1024 * 1024
const SAFETY_MARGIN = 0.8

const PER_FILE_LIMITS = {
	image: 0.3,
	video: 0.15,
} as const

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

interface MappedAttachment {
	name: string
	url: string
	size: number
	sizeFormatted: string
	extension: string
	mimeType: string
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

type EmbedType = 'image' | 'video'

interface EmbedOptions {
	maxFileSize?: number
	embedTypes?: EmbedType[]
}

interface EmbedResult<T> {
	messages: T[]
	totalEmbeddedSize: number
	embeddedCount: number
	skippedCount: number
}

function getMimeType(attachment: MappedAttachment, serverContentType: string | null): string {
	const ext = attachment.extension.toLowerCase()
	const fromExt = MIME_TYPES[ext]
	const fromServer = serverContentType?.split(';')[0].trim()

	if (fromServer && fromServer !== 'application/octet-stream') {
		return fromServer
	}
	if (fromExt) return fromExt
	if (fromServer) return fromServer
	return 'application/octet-stream'
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

async function fetchAsDataUri(
	attachment: MappedAttachment,
): Promise<{ dataUri: string; mimeType: string; size: number } | null> {
	try {
		const response = await fetch(attachment.url)
		if (!response.ok) return null

		const serverContentType = response.headers.get('content-type')
		const mimeType = getMimeType(attachment, serverContentType)
		const buffer = await response.arrayBuffer()
		const base64 = Buffer.from(buffer).toString('base64')
		const dataUri = `data:${mimeType};base64,${base64}`

		return { dataUri, mimeType, size: buffer.byteLength }
	} catch {
		return null
	}
}

function getMediaType(attachment: MappedAttachment): 'image' | 'video' | null {
	if (attachment.isImage) return 'image'
	if (attachment.isVideo) return 'video'
	return null
}

function canEmbed(
	attachment: MappedAttachment,
	currentSize: number,
	targetSize: number,
	embedTypes: EmbedType[],
): boolean {
	const mediaType = getMediaType(attachment)
	if (!mediaType) return false
	if (!embedTypes.includes(mediaType)) return false

	if (currentSize >= targetSize) return false

	const perFileLimit = targetSize * PER_FILE_LIMITS[mediaType]
	if (attachment.size > perFileLimit) return false
	if (attachment.size > targetSize - currentSize) return false

	return true
}

export async function embedMedia<T extends { attachments: MappedAttachment[]; [key: string]: any }>(
	messages: T[],
	options: EmbedOptions = {},
): Promise<EmbedResult<T>> {
	const { maxFileSize = DISCORD_FILE_LIMIT, embedTypes = ['image', 'video'] } = options
	const targetSize = maxFileSize * SAFETY_MARGIN
	let accumulatedSize = 0
	let embeddedCount = 0
	let skippedCount = 0

	const processedMessages = await Promise.all(
		messages.map(async (msg) => {
			if (!msg.attachments || msg.attachments.length === 0) return msg

			const processedAttachments = await Promise.all(
				msg.attachments.map(async (attachment) => {
					if (!canEmbed(attachment, accumulatedSize, targetSize, embedTypes)) {
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

					const result = await fetchAsDataUri(attachment)
					if (!result) {
						skippedCount++
						return attachment
					}

					accumulatedSize += result.size
					embeddedCount++

					return {
						...attachment,
						url: result.dataUri,
						mimeType: result.mimeType,
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
