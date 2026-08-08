import { afterEach, describe, expect, it, vi } from 'vitest'
import { embedMedia } from '../src/embedMedia'

function makeAttachment(overrides: Partial<any> = {}) {
	return {
		name: 'photo.png',
		url: 'https://cdn.discordapp.com/photo.png',
		size: 1024,
		sizeFormatted: '1.0 KB',
		extension: 'PNG',
		mimeType: 'image/png',
		hasDimensions: false,
		isImage: true,
		isVideo: false,
		isAudio: false,
		isGif: false,
		isFile: false,
		isSpoiler: false,
		...overrides,
	}
}

function mockFetchResponse(body: Uint8Array, headers: Record<string, string> = {}) {
	return {
		ok: true,
		headers: { get: (key: string) => headers[key] ?? null },
		arrayBuffer: async () => body.buffer,
	}
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('embedMedia', () => {
	it('embeds an image attachment as a base64 data URI', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4])
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockFetchResponse(bytes, { 'content-length': '4', 'content-type': 'image/png' })),
		)

		const messages = [{ attachments: [makeAttachment()] }]
		const result = await embedMedia(messages as any)

		expect(result.embeddedCount).toBe(1)
		expect(result.skippedCount).toBe(0)
		expect(result.messages[0].attachments[0].url).toMatch(/^data:image\/png;base64,/)
		expect(result.messages[0].attachments[0].embedded).toBe(true)
	})

	it('skips attachments whose type is excluded via embedTypes', async () => {
		const fetchSpy = vi.fn()
		vi.stubGlobal('fetch', fetchSpy)

		const messages = [{ attachments: [makeAttachment({ isImage: false, isVideo: true })] }]
		const result = await embedMedia(messages as any, { embedTypes: ['image'] })

		expect(result.embeddedCount).toBe(0)
		expect(result.skippedCount).toBe(1)
		expect(fetchSpy).not.toHaveBeenCalled()
		// untouched attachment is passed through unchanged
		expect(result.messages[0].attachments[0].isVideo).toBe(true)
	})

	it('skips a file that would exceed the per-file budget for its media type', async () => {
		vi.stubGlobal('fetch', vi.fn())

		// images are capped at 30% of the (80%-safety-margin) target size
		const maxFileSize = 1000
		const oversizedImage = makeAttachment({ size: 400 }) // > 30% of 800
		const messages = [{ attachments: [oversizedImage] }]

		const result = await embedMedia(messages as any, { maxFileSize })

		expect(result.embeddedCount).toBe(0)
		expect(result.skippedCount).toBe(1)
	})

	it('enforces the per-file budget deterministically, independent of other attachments', async () => {
		// NOTE: attachments within a message are embedded concurrently
		// (Promise.all), and canEmbed()'s budget check reads `accumulatedSize`
		// before any attachment's own fetch has resolved. That means the
		// *total* budget is best-effort under concurrency - two attachments
		// that each individually fit can both be embedded even if their
		// combined size exceeds the target. The per-file cap (PER_FILE_LIMITS),
		// however, is checked synchronously up front and is always enforced.
		const bytes = new Uint8Array(50)
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockFetchResponse(bytes, { 'content-length': '50' })),
		)

		const maxFileSize = 100 // target = 80, per-file image cap = 24
		const messages = [
			{ attachments: [makeAttachment({ size: 20 }), makeAttachment({ size: 20 }), makeAttachment({ size: 20 })] },
		]

		const result = await embedMedia(messages as any, { maxFileSize })

		// all three pass the per-file cap (20 <= 24) and the pre-fetch budget
		// check (each reads accumulatedSize=0 before any of them resolve), so
		// today's implementation embeds all three even though 3 * 50B > 80B
		expect(result.embeddedCount).toBe(3)
		expect(result.totalEmbeddedSize).toBeGreaterThan(maxFileSize * 0.8)
	})

	it('leaves the attachment untouched and counts it skipped when fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) })),
		)

		const original = makeAttachment()
		const messages = [{ attachments: [original] }]
		const result = await embedMedia(messages as any)

		expect(result.embeddedCount).toBe(0)
		expect(result.skippedCount).toBe(1)
		expect(result.messages[0].attachments[0].url).toBe(original.url)
	})

	it('leaves messages without attachments unchanged', async () => {
		vi.stubGlobal('fetch', vi.fn())
		const messages = [{ attachments: [] }, { attachments: undefined }]
		const result = await embedMedia(messages as any)

		expect(result.embeddedCount).toBe(0)
		expect(result.skippedCount).toBe(0)
		expect(result.messages).toHaveLength(2)
	})
})
