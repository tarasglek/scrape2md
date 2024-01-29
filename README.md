
# scrape2md: Web Content to Markdown Converter

This library is designed to scrape web content and convert it into readable Markdown format, suitable for both large language models and human readers. It simplifies the process of extracting information from various sources, including HTML pages and PDF documents, and presents it in a clean, structured Markdown format.

This is meant to be a fast lib that can be deployed on serverless platforms like Cloudflare without the deployment complexity of heavier-weight scrapers using headless browsers.

## Features

- Fetch and convert web content to Markdown.
- Support for HTML and PDF content types.
- Extracts and converts Open Graph data to Markdown.
- Compatible with both browser and Node.js environments.
- Can scrape following sites:
    * Most articles via Mozilla readability
    * twitter via OG parsing + fxtwitter.com
    * youtube using generated subtitles

## Installation

```bash
pnpm install web-content-to-markdown
```

## Usage

As a library:

```js
import { fetchAndConvertToMarkdown } from 'web-content-to-markdown';

// Example: Convert content from a URL to Markdown
const url = 'https://www.youtube.com/watch?v=U7PUn1Pq0iM';
fetchAndConvertToMarkdown(url, fetch)
  .then(markdown => console.log(markdown))
  .catch(error => console.error(error));
```

Via cli:
```bash
pnpm tsx cli.ts 'https://www.youtube.com/watch?v=U7PUn1Pq0iM'
```

## API

### `fetchAndConvertToMarkdown(url: string, fetchFunc: typeof fetch): Promise<string>`

Fetches content from the specified URL and converts it to Markdown. The `fetchFunc` parameter allows you to provide a custom fetch function, making the library flexible for different environments.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue to suggest improvements or add new features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
