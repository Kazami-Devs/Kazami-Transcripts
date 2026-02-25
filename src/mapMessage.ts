import type { Embed, Message } from 'discord.js'
import { MessageType } from 'discord.js'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDiscordMarkdown(text: string): string {
  if (!text) return ''
  
  // Code blocks (```code```) - process first to avoid conflicts
  text = text.replace(/```(?:(\w+)\n)?([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="dc-code-block"><code>${code}</code></pre>`
  })
  
  // Inline code (`code`)
  text = text.replace(/`([^`]+?)`/g, '<code class="dc-code-inline">$1</code>')
  
  // Spoilers (||spoiler||)
  text = text.replace(/\|\|(.+?)\|\|/g, '<span class="dc-spoiler">$1</span>')
  
  // Bold italic (***text*** or ___text___)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  
  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__(.+?)__/g, '<u>$1</u>')
  
  // Italic (*text* or _text_)
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  text = text.replace(/_(.+?)_/g, '<em>$1</em>')
  
  // Strikethrough (~~text~~)
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>')
  
  // Blockquotes (> text)
  text = text.replace(/^&gt;\s?(.+)$/gm, '<blockquote class="dc-quote">$1</blockquote>')
  
  // Headers (# heading)
  text = text.replace(/^#\s(.+)$/gm, '<h1 class="dc-header-1">$1</h1>')
  text = text.replace(/^##\s(.+)$/gm, '<h2 class="dc-header-2">$1</h2>')
  text = text.replace(/^###\s(.+)$/gm, '<h3 class="dc-header-3">$1</h3>')
  
  // List items (- item or -# item for small text)
  text = text.replace(/^-#\s(.+)$/gm, '<div class="dc-list-item-small">$1</div>')
  text = text.replace(/^-\s(.+)$/gm, '<div class="dc-list-item">• $1</div>')
  
  // Timestamps (<t:timestamp:format>)
  text = text.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?\&gt;/g, (match, timestamp, format) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return `<span class="dc-timestamp">${date.toLocaleString()}</span>`
  })

  // Markdown links ([text](url))
  text = text.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" class="dc-link" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Auto-link URLs (but not if already in HTML tags)
  text = text.replace(/(?<!href="|src="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" class="dc-link" target="_blank" rel="noopener noreferrer">$1</a>')
  
  return text
}

function formatContent(content: string, message: Message): string {
  if (!content) return ''
  
  // First, escape HTML to prevent XSS
  let formattedContent = escapeHtml(content)
  
  // Replace user mentions &lt;@USER_ID&gt; (escaped version)
  formattedContent = formattedContent.replace(/&lt;@!?(\d+)&gt;/g, (match, userId) => {
    const user = message.mentions.users.get(userId)
    const username = user ? escapeHtml(user.username) : 'Unknown User'
    return `<span class="dc-mention">@${username}</span>`
  })
  
  // Replace role mentions &lt;@&amp;ROLE_ID&gt; (escaped version)
  formattedContent = formattedContent.replace(/&lt;@&amp;(\d+)&gt;/g, (match, roleId) => {
    const role = message.guild?.roles.cache.get(roleId)
    const roleName = role ? escapeHtml(role.name) : 'Unknown Role'
    const roleColor = role?.color ? role.color.toString(16).padStart(6, '0') : '5865f2'
    return `<span class="dc-mention dc-mention-role" style="--dc-mention-color-rgb: ${parseInt(roleColor.slice(0, 2), 16)} ${parseInt(roleColor.slice(2, 4), 16)} ${parseInt(roleColor.slice(4, 6), 16)}">@${roleName}</span>`
  })
  
  // Replace channel mentions &lt;#CHANNEL_ID&gt; (escaped version)
  formattedContent = formattedContent.replace(/&lt;#(\d+)&gt;/g, (match, channelId) => {
    const channel = message.guild?.channels.cache.get(channelId)
    const channelName = channel ? escapeHtml(channel.name) : 'Unknown Channel'
    return `<span class="dc-mention">#${channelName}</span>`
  })
  
  // Apply Discord markdown formatting
  formattedContent = formatDiscordMarkdown(formattedContent)
  
  return formattedContent
}

function getSystemMessageText(message: Message): string | null {
  const author = escapeHtml(message.author.username)
  
  switch (message.type) {
    case MessageType.RecipientAdd:
      if (message.mentions.users.size > 0) {
        const addedUser = escapeHtml(message.mentions.users.first()!.username)
        return `${author} added ${addedUser} to the thread.`
      }
      return `${author} added someone to the thread.`
      
    case MessageType.RecipientRemove:
      if (message.mentions.users.size > 0) {
        const removedUser = escapeHtml(message.mentions.users.first()!.username)
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
      return null // Regular reply, not a system message
      
    case MessageType.ChatInputCommand:
      return null // Regular slash command, not a system message
      
    case MessageType.ThreadStarterMessage:
      return null // Thread starter, not really a system message
      
    case MessageType.ContextMenuCommand:
      return null // Context menu command, not a system message
      
    case MessageType.AutoModerationAction:
      return `AutoMod flagged a message.`
      
    default:
      return null
  }
}

function mapComponents(components: any[], message: Message): any[] {
  if (!components || !Array.isArray(components)) return []
  
  return components.map((component) => {
    const mapped: any = {
      type: component.type,
      id: component.id,
      isText: component.type === 10,
      isContainer: component.type === 17,
      isSeparator: component.type === 14,
      isActionRow: component.type === 1,
      isButton: component.type === 2,
    }
    
    // Type 10: Text component (com suporte a mentions)
    if (component.type === 10) {
      mapped.content = formatContent(component.content || '', message)
    }
    
    // Type 17: Container component
    if (component.type === 17) {
      mapped.accentColor = component.accent_color 
        ? `#${component.accent_color.toString(16).padStart(6, '0')}` 
        : null
      mapped.spoiler = component.spoiler || false
      mapped.components = mapComponents(component.components || [], message)
    }
    
    // Type 14: Separator
    if (component.type === 14) {
      mapped.spacing = component.spacing || 0
      mapped.divider = component.divider || false
    }
    
    // Type 1: Action Row (já existente, contém botões)
    if (component.type === 1) {
      mapped.components = mapComponents(component.components || [], message)
    }
    
    // Type 2: Button
    if (component.type === 2) {
      mapped.customId = component.custom_id
      mapped.style = component.style // 1=Primary, 2=Secondary, 3=Success, 4=Danger, 5=Link
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
    
    return mapped
  })
}

export function mapMessage(message: Message, formatDate: (date: Date) => string) {
  const formatEmbedText = (text?: string | null) => (text ? formatContent(text, message) : null)
  const formatEmbedFieldText = (text?: string | null) => (text ? formatContent(text, message) : '')

  const embeds = message.embeds.map((embed: Embed) => ({
    title: formatEmbedText(embed.title),
    description: formatEmbedText(embed.description),
    color: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#7289da',
    fields:
      embed.fields?.map((field) => ({
        name: formatEmbedFieldText(field.name),
        value: formatEmbedFieldText(field.value),
        inline: field.inline,
      })) ?? [],
    image: embed.image?.url,
    thumbnail: embed.thumbnail?.url,
    author: formatEmbedText(embed.author?.name),
    footer: formatEmbedText(embed.footer?.text),
    url: embed.url,
  }))

  const attachments = message.attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    isImage: attachment.contentType?.startsWith('image'),
    isVideo: attachment.contentType?.startsWith('video'),
    isAudio: attachment.contentType?.startsWith('audio'),
  }))

  const stickers = message.stickers.map((sticker) => ({
    name: sticker.name,
    url: sticker.url,
    format: sticker.format,
  }))

  // Detect tenor.com GIFs in embeds and filter them out from regular embeds
  const tenorGifs: string[] = []
  const regularEmbeds = embeds.filter((embed) => {
    // Check if the embed is from Tenor
    const isTenorEmbed = 
      (embed.url && (embed.url.includes('tenor.com') || embed.url.includes('media.tenor.com'))) ||
      (embed.image && (embed.image.includes('tenor.com') || embed.image.includes('media.tenor.com') || embed.image.includes('tenor.gif'))) ||
      (embed.thumbnail && (embed.thumbnail.includes('tenor.com') || embed.thumbnail.includes('media.tenor.com') || embed.thumbnail.includes('tenor.gif')))
    
    if (isTenorEmbed) {
      // Extract the GIF URL (prefer image, fallback to thumbnail)
      const gifUrl = embed.image || embed.thumbnail
      if (gifUrl) {
        tenorGifs.push(gifUrl)
      }
      return false // Don't include tenor embeds in regular embeds
    }
    return true
  })

  // Check if content is only a tenor.com URL
  const contentTrimmed = message.content?.trim() ?? ''
  const tenorUrlRegex = /^https?:\/\/(www\.)?tenor\.com\/view\/[^\s]+$/
  const isOnlyTenorUrl = tenorUrlRegex.test(contentTrimmed)

  // Format content with mentions (but hide if it's only a tenor URL)
  let processedContent = isOnlyTenorUrl ? null : formatContent(message.content ?? '', message)

  // Check if this is a system message
  const systemMessageText = getSystemMessageText(message)
  const isSystemMessage = systemMessageText !== null

  const isBot = message.author.bot
  const isCommand = message.interaction !== null
  const commandName = message.interaction?.commandName ?? null
  const commandUser = message.interaction?.user?.username ?? null
  const commandUserAvatar = message.interaction?.user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null

  // Map components (v1 and v2)
  const components = mapComponents(message.components as any, message)

  return {
    author: message.author.username,
    avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
    content: processedContent,
    timestamp: formatDate(message.createdAt),
    embeds: regularEmbeds,
    attachments,
    stickers,
    tenorGifs,
    hasEmbeds: regularEmbeds.length > 0,
    hasAttachments: attachments.length > 0,
    hasStickers: stickers.length > 0,
    hasTenorGifs: tenorGifs.length > 0,
    isBot,
    isCommand,
    commandName,
    commandUser,
    commandUserAvatar,
    isSystemMessage,
    systemMessageText,
    components,
    hasComponents: components.length > 0,
  }
}
