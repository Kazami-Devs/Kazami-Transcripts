import { MessageType } from 'discord.js'

function collection(items: Record<string, any>) {
	const map = new Map(Object.entries(items))
	return {
		get: (id: string) => map.get(id),
		first: () => map.values().next().value,
	}
}

export function fakeUser(overrides: Partial<any> = {}) {
	return {
		id: '1',
		username: 'kazami',
		bot: false,
		displayAvatarURL: (_opts?: any) => 'https://cdn.discordapp.com/avatars/1/avatar.png',
		...overrides,
	}
}

export function fakeMessage(overrides: Partial<any> = {}) {
	return {
		id: 'm1',
		content: '',
		type: MessageType.Default,
		createdAt: new Date('2026-01-01T12:00:00Z'),
		author: fakeUser(),
		member: null,
		guild: null,
		mentions: { users: collection({}) },
		embeds: [],
		attachments: [],
		stickers: [],
		components: [],
		interaction: null,
		interactionMetadata: null,
		reference: null,
		...overrides,
	}
}

export function fakeGuild(overrides: Partial<any> = {}) {
	return {
		name: 'Kazami Server',
		iconURL: (_opts?: any) => 'https://cdn.discordapp.com/icons/1/icon.png',
		members: { cache: collection({}) },
		roles: { cache: collection({}) },
		channels: { cache: collection({}) },
		...overrides,
	}
}

/**
 * Fake TextBasedChannel. `pages` is a list of Message[] batches returned by
 * successive calls to `messages.fetch`, oldest-fetch-call-first, mirroring
 * how Discord paginates with `before`.
 */
export function fakeChannel(opts: { name?: string; isDM?: boolean; guild?: any; pages?: any[][] }) {
	const pages = opts.pages ?? []
	let callIndex = 0

	return {
		name: opts.name ?? 'general',
		guild: opts.guild ?? fakeGuild(),
		isDMBased: () => opts.isDM ?? false,
		messages: {
			fetch: async (_options: any) => {
				const page = pages[callIndex] ?? []
				callIndex++
				return {
					size: page.length,
					values: () => page.values(),
					last: () => page[page.length - 1],
				}
			},
		},
	}
}
