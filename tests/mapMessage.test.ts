import { describe, expect, it } from 'vitest'
import { MessageType } from 'discord.js'
import { mapMessage, mapReplyPreview } from '../src/mapMessage'
import { fakeGuild, fakeMessage, fakeUser } from './helpers'

const formatDate = (date: Date) => date.toISOString()
const formatTime = (date: Date) => date.toISOString()

describe('mapMessage - basic fields', () => {
	it('maps author, timestamps and ids from the raw message', () => {
		const message = fakeMessage({ content: 'hello world' })
		const result = mapMessage(message as any, formatDate, formatTime)

		expect(result.messageId).toBe('m1')
		expect(result.author).toBe('kazami')
		expect(result.content).toContain('hello world')
		expect(result.isSystemMessage).toBe(false)
	})

	it('escapes raw HTML in message content', () => {
		const message = fakeMessage({ content: '<script>alert(1)</script>' })
		const result = mapMessage(message as any, formatDate, formatTime)

		expect(result.content).not.toContain('<script>')
		expect(result.content).toContain('&lt;script&gt;')
	})
})

describe('mapMessage - discord markdown', () => {
	it.each([
		['**bold**', '<strong>bold</strong>'],
		['*italic*', '<em>italic</em>'],
		['__underline__', '<u>underline</u>'],
		['~~strike~~', '<del>strike</del>'],
		['`code`', '<code class="dc-code-inline">code</code>'],
		['||spoiler||', '<span class="dc-spoiler">spoiler</span>'],
	])('converts %s to %s', (input, expectedHtml) => {
		const message = fakeMessage({ content: input })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain(expectedHtml)
	})

	it('converts a fenced code block, preserving the code body', () => {
		const message = fakeMessage({ content: '```js\nconst a = 1;\n```' })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('<pre class="dc-code-block">')
		expect(result.content).toContain('const a = 1;')
	})

	it('converts markdown links to anchor tags', () => {
		const message = fakeMessage({ content: '[Kazami](https://example.com)' })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('href="https://example.com"')
		expect(result.content).toContain('>Kazami</a>')
	})

	it('autolinks bare urls that are not image urls', () => {
		const message = fakeMessage({ content: 'check https://example.com/page out' })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('<a href="https://example.com/page"')
	})
})

describe('mapMessage - mentions', () => {
	it('resolves a known user mention to their username', () => {
		const guild = fakeGuild()
		const message = fakeMessage({
			content: '<@123>',
			guild,
			mentions: { users: { get: (id: string) => (id === '123' ? fakeUser({ username: 'ana' }) : undefined) } },
		})
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('@ana')
		expect(result.content).toContain('dc-mention')
	})

	it('falls back to "Unknown User" for an unresolved mention', () => {
		const message = fakeMessage({
			content: '<@999>',
			mentions: { users: { get: () => undefined } },
		})
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('@Unknown User')
	})

	it('resolves a role mention using the guild role cache', () => {
		const guild = fakeGuild({
			roles: { cache: { get: (id: string) => (id === '55' ? { name: 'Admins', color: 0x5865f2 } : undefined) } },
		})
		const message = fakeMessage({ content: '<@&55>', guild })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('@Admins')
	})

	it('resolves a channel mention using the guild channel cache', () => {
		const guild = fakeGuild({
			channels: { cache: { get: (id: string) => (id === '77' ? { name: 'general' } : undefined) } },
		})
		const message = fakeMessage({ content: '<#77>', guild })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.content).toContain('#general')
	})
})

describe('mapMessage - attachments', () => {
	it('classifies an image attachment by extension', () => {
		const message = fakeMessage({
			attachments: [
				{ name: 'photo.png', url: 'https://cdn.discordapp.com/photo.png', size: 2048, proxyURL: null, spoiler: false },
			],
		})
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.attachments[0].isImage).toBe(true)
		expect(result.attachments[0].isVideo).toBe(false)
		expect(result.attachments[0].isFile).toBe(false)
		expect(result.attachments[0].sizeFormatted).toBe('2.0 KB')
	})

	it('classifies a video attachment by content type when the extension is ambiguous', () => {
		const message = fakeMessage({
			attachments: [
				{
					name: 'clip',
					url: 'https://cdn.discordapp.com/clip',
					size: 1024,
					contentType: 'video/mp4',
					proxyURL: null,
					spoiler: false,
				},
			],
		})
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.attachments[0].isVideo).toBe(true)
	})

	it('falls back to "isFile" for unrecognized attachment types', () => {
		const message = fakeMessage({
			attachments: [
				{ name: 'notes.txt', url: 'https://cdn.discordapp.com/notes.txt', size: 100, proxyURL: null, spoiler: false },
			],
		})
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.attachments[0].isFile).toBe(true)
	})

	it('sets hasAttachments based on whether any attachments exist', () => {
		const withAttachment = fakeMessage({
			attachments: [{ name: 'a.png', url: 'u', size: 1, proxyURL: null, spoiler: false }],
		})
		const withoutAttachment = fakeMessage({})

		expect(mapMessage(withAttachment as any, formatDate, formatTime).hasAttachments).toBe(true)
		expect(mapMessage(withoutAttachment as any, formatDate, formatTime).hasAttachments).toBe(false)
	})
})

describe('mapMessage - system messages', () => {
	it('generates readable text for a user-join system message', () => {
		const message = fakeMessage({ type: MessageType.UserJoin })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.isSystemMessage).toBe(true)
		expect(result.systemMessageText).toBe('kazami joined the server.')
	})

	it('generates readable text for a channel pinned message', () => {
		const message = fakeMessage({ type: MessageType.ChannelPinnedMessage })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.systemMessageText).toBe('kazami pinned a message to this channel.')
	})

	it('treats normal messages as non-system', () => {
		const message = fakeMessage({ type: MessageType.Default, content: 'hi' })
		const result = mapMessage(message as any, formatDate, formatTime)
		expect(result.isSystemMessage).toBe(false)
		expect(result.systemMessageText).toBeNull()
	})
})

describe('mapReplyPreview', () => {
	it('truncates long content to 140 characters', () => {
		const longText = 'x'.repeat(200)
		const message = fakeMessage({ content: longText })
		const preview = mapReplyPreview(message as any)
		// content is HTML-formatted, but the raw slice should not include
		// characters past index 140 of the original text
		expect(preview.hasContent).toBe(true)
		expect(preview.content).not.toContain('x'.repeat(150))
	})

	it('flags hasAttachment when there is no text but an attachment exists', () => {
		const message = fakeMessage({
			content: '',
			attachments: { size: 1 },
		})
		const preview = mapReplyPreview(message as any)
		expect(preview.hasContent).toBe(false)
		expect(preview.hasAttachment).toBe(true)
	})
})
