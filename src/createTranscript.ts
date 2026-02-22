import fs from 'node:fs'
import path from 'node:path'
import type { Message, TextBasedChannel } from 'discord.js'
import Mustache from 'mustache'
import { mapMessage } from './mapMessage'
import type { TranscriptOptions, TranscriptResult } from './types'

const template = fs.readFileSync(path.join(__dirname, 'assets', 'transcript.md.mustache'), 'utf-8')

export async function createTranscript(
  channel: TextBasedChannel,

  options: TranscriptOptions = {}
): Promise<TranscriptResult> {
  if (channel.isDMBased()) throw new Error('DM channels are not supported')

  const { guildName = 'Unknown Guild', locale = 'en-US', timezone = 'UTC', limit = 100, returnType = 'string' } = options
  const fileName = `transcript-${channel.name}.html`

  let allMessages: Message[] = []
  let lastId: string | undefined

  while (true) {
    const fetchOptions: any = { limit: limit ?? 100 }
    if (lastId) fetchOptions.before = lastId

    const fetchedMessages: any = await channel.messages.fetch(fetchOptions)
    if (!fetchedMessages.size) break

    allMessages = [...fetchedMessages.values(), ...allMessages]
    lastId = fetchedMessages.last()?.id
  }

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date)

  const renderData = {
    channelName: channel.name,
    guildName,
    createdAtFull: formatDate(new Date()),
    closedAtFull: formatDate(new Date()),
    messages: allMessages.reverse().map((message) => mapMessage(message, formatDate)),
  }

  const html = Mustache.render(template, renderData)

  return { fileName, html: returnType === 'buffer' ? Buffer.from(html) : html }
}
