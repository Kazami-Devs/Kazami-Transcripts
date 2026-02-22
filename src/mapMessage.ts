import type { Embed, Message } from 'discord.js'

export function mapMessage(message: Message, formatDate: (date: Date) => string) {
  const embeds = message.embeds.map((embed: Embed) => ({
    title: embed.title,
    description: embed.description,
    color: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#7289da',
    fields:
      embed.fields?.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      })) ?? [],
    imaghe: embed.image?.url,
    thumbnail: embed.thumbnail?.url,
    author: embed.author?.name,
    footer: embed.footer?.text,
  }))

  const attachments = message.attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    isImage: attachment.contentType?.startsWith('image'),
    isVideo: attachment.contentType?.startsWith('video'),
    isAudio: attachment.contentType?.startsWith('audio'),
  }))

  return {
    author: message.author.username,
    avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
    content: message.content ?? null,
    timestamp: formatDate(message.createdAt),
    embeds,
    attachments,
    hasEmbes: embeds.length > 0,
    hasAttachments: attachments.length > 0,
  }
}
