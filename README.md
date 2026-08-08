# Kazami Transcipts

Generate beautiful HTML transcripts from Discord text channels using Discord.Js.

Lightweight, customizable and easy to use.

---

## Features

- Generate full HTML transcripts with Discord-like UI
- Locale & timezone support
- Custom Mustache template support
- Fast message fetching with message grouping
- Media embedding — store images and videos as base64 for CDN-free HTML files
- Built for Discord.Js
- TypeScript support

---

## Installation

```bash
npm install @kazami-devs/transcripts
```

---

## Basic Usage

```js
const { createTranscript } = require('@kazami-devs/transcripts')
const { AttachmentBuilder } = require('discord.js')

const transcript = await createTranscript(channel)

const attachment = new AttachmentBuilder(
  Buffer.from(transcript.html, 'utf-8'),
  { name: transcript.fileName }
)

await interaction.reply({
  content: 'Transcript created successfully!',
  files: [attachment],
})
```

---

## Advanced Usage

```js
const transcript = await createTranscript(channel, {
  guildName: interaction.guild.name,
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  limit: -1, // fetch all messages
  embedMedia: true, // embed images as base64 (self-contained HTML)
})
```

---

## Options

| Option       | Type      | Default      | Description |
|--------------|-----------|--------------|-------------|
| `limit`      | number    | 100          | Number of messages to fetch (-1 = all) |
| `guildName`  | string    | —            | Guild name displayed in transcript |
| `locale`     | string    | en-US        | Date formatting locale |
| `timezone`   | string    | UTC          | Timezone for timestamps |
| `returnType` | string    | "string"     | Return type: "string" or "buffer" |
| `embedMedia` | boolean   | false        | Embed images and videos as base64 data URIs (self-contained HTML) |
| `embedTypes` | string[]  | ["image","video"] | Media types to embed: `"image"`, `"video"`, or both. Only used when `embedMedia` is true |
| `maxFileSize`| number    | 26214400     | Max HTML file size in bytes (25 MB). Only used when `embedMedia` is true |

### Return Value

```ts
{
  fileName: string
  html: string | Buffer
}
```

---

## Media Embedding

When `embedMedia: true` is enabled, the library will:

1. Fetch each media attachment from Discord's CDN
2. Convert it to a base64 data URI
3. Embed it directly in the HTML file

This makes the HTML file **self-contained** — it won't depend on Discord CDN URLs that expire.

### Supported Media Types

| Type | Extensions | Per-File Limit |
|------|-----------|----------------|
| Images | png, jpg, gif, webp, bmp, svg, avif | 30% of budget |
| Videos | mp4, webm, mov, mkv, avi, m4v | 15% of budget |

### Size Limits

Discord has a **25 MB** file upload limit. The embedding algorithm uses an **80% safety margin** (20 MB target) to ensure the final HTML can be sent by any user.

- **Embedded**: Media that fits within the per-file and total budget
- **Skipped**: Files that would exceed limits stay as CDN links
- **Graceful fallback**: If a file can't be fetched, it stays as a CDN link

```js
// Embed all media, respecting Discord's 25 MB limit
const transcript = await createTranscript(channel, {
  embedMedia: true,
  maxFileSize: 25 * 1024 * 1024, // optional, defaults to 25 MB
})

// Embed only images (skip videos)
const transcript = await createTranscript(channel, {
  embedMedia: true,
  embedTypes: ['image'],
})

// Embed only videos (skip images)
const transcript = await createTranscript(channel, {
  embedMedia: true,
  embedTypes: ['video'],
})
```

---

## Peer Dependencies

```
discord.js ^14.0.0
```

---

## License

This project is licensed under the MIT license. Feel free to contribute!

## Author

Developed with love by [Camilla Viana](https://github.com/EaCamih) 💜

## ❤️ Contributing
Pull requests are welcome.
If you'd like to suggest improvements, feel free to open an issue.
