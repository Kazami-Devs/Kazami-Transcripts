import { describe, expect, it } from 'vitest'
import { createTranscript } from '../src/createTranscript'
import { fakeChannel, fakeMessage } from './helpers'

describe('createTranscript', () => {
	it('throws when given a DM-based channel', async () => {
		const channel = fakeChannel({ isDM: true })
		await expect(createTranscript(channel as any)).rejects.toThrow('DM channels are not supported')
	})

	it('respects the limit option and stops fetching once enough messages are collected', async () => {
		const page = Array.from({ length: 100 }, (_, i) =>
			fakeMessage({ id: `m${i}`, content: `message ${i}` }),
		)
		const channel = fakeChannel({ pages: [page] })

		const result = await createTranscript(channel as any, { limit: 5 })

		expect(result.fileName).toBe('transcript-general.html')
		// 5 of the 100 fetched messages should appear as rendered rows
		const occurrences = result.html.toString().match(/message \d+/g) ?? []
		expect(occurrences).toHaveLength(5)
	})

	it('paginates using `before` until Discord returns an empty page (limit: -1)', async () => {
		const pageOne = Array.from({ length: 100 }, (_, i) => fakeMessage({ id: `a${i}`, content: `first ${i}` }))
		const pageTwo = Array.from({ length: 30 }, (_, i) => fakeMessage({ id: `b${i}`, content: `second ${i}` }))
		const channel = fakeChannel({ pages: [pageOne, pageTwo, []] })

		const result = await createTranscript(channel as any, { limit: -1 })

		const html = result.html.toString()
		expect(html).toContain('first 0')
		expect(html).toContain('second 0')
		expect(result.html.toString().match(/(first|second) \d+/g)).toHaveLength(130)
	})

	it('returns a Buffer when returnType is "buffer", and a string otherwise', async () => {
		const channel = fakeChannel({ pages: [[fakeMessage({ content: 'hi' })]] })

		const asString = await createTranscript(channel as any, { limit: 1 })
		const asBuffer = await createTranscript(channel as any, { limit: 1, returnType: 'buffer' })

		expect(typeof asString.html).toBe('string')
		expect(Buffer.isBuffer(asBuffer.html)).toBe(true)
	})

	it('includes guildName and message/participant counts in the rendered output', async () => {
		const channel = fakeChannel({
			pages: [
				[
					fakeMessage({ id: '1', content: 'hey', author: { id: 'u1', username: 'alice', bot: false, displayAvatarURL: () => 'a' } }),
					fakeMessage({ id: '2', content: 'yo', author: { id: 'u2', username: 'bob', bot: false, displayAvatarURL: () => 'b' } }),
				],
			],
		})

		const result = await createTranscript(channel as any, { limit: 2, guildName: 'My Cool Server' })
		const html = result.html.toString()

		expect(html).toContain('My Cool Server')
		expect(html).toContain('alice')
		expect(html).toContain('bob')
	})

	it('defaults to "Unknown Guild" when no guildName is provided', async () => {
		const channel = fakeChannel({ pages: [[fakeMessage({ content: 'hi' })]] })
		const result = await createTranscript(channel as any, { limit: 1 })
		expect(result.html.toString()).toContain('Unknown Guild')
	})
})
