# Kazami Transcipts

Generate beautiful HTML transcripts from Discord text channels using Discord.Js.

Lightweight, customizable and easy to use.

---

## Features

- Generate full HTML transcripts
- Locale & timezone support
- Custom Mustache template support
- Fast message fetching
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
const { createTranscript } = require('kazami-transcripts')
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
})
```

---

## Options

| Option     | Type      | Default | Description |
|------------|-----------|----------|-------------|
| `limit`    | number    | 100      | Number of messages to fetch (-1 = all) |
| `guildName`| string    | —        | Guild name displayed in transcript |
| `locale`   | string    | en-US    | Date formatting locale |
| `timezone` | string    | UTC      | Timezone for timestamps |

### Return Value


```ts
{
  fileName: string
  html: string
}
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