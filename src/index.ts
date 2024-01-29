import opengraph_scraper from "open-graph-scraper";
import pdf2md from "@opendocsg/pdf2md";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { getSubtitles } from "youtube-captions-scraper";

/**
 * Interface for Open Graph data.
 */
interface OgObject {
  ogTitle?: string;
  ogDescription?: string;
  ogDate?: string;
  ogImage?: Array<{ url: string }>;
}

/**
* Parses HTML to extract Open Graph data.
*/
async function parseOg(html: string): Promise<OgObject> {
    // Set up options for openGraphScraper
    const options = {
        html, // Pass the HTML content directly
        timeout: 10000, // Set a timeout for the request (10 seconds)
    };

    // Use openGraphScraper to parse the HTML content
    const ret = await opengraph_scraper(options);
    if (ret.error) {
        console.error("Failed to get OG", ret.response);
        return {};
    }
    return ret.result;
}

/**
* Converts Open Graph data to Markdown.
*/
function ogToMarkdown(ogData: OgObject): string {
  const { ogTitle, ogDescription, ogImage, ogDate } = ogData;

  let markdown = "";

  if (ogTitle) {
      markdown += `# ${ogTitle}\n\n`;
  }

  if (ogDate) {
      const formattedDate = new Date(ogDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
      });
      markdown += `*${formattedDate}*\n\n`;
  }

  const imgURL = ogImage ? ogImage[0]?.url : undefined;
  if (imgURL) {
      markdown += `![Thumbnail](${imgURL})\n\n`;
  }

  if (ogDescription) {
      markdown += `${ogDescription}\n\n`;
  }

  return markdown;
}

/**
* Rewrites URLs to be more scrape-friendly.
*/
function scrapeableUrl(url: URL): { url: URL; redirect: 'follow' | 'manual', userAgent: string } {
  // Combined regex to match 'x.com' or 'twitter.com' and any subdomains
  const domainRegex = /^(?:.*\.)?(twitter\.com|x\.com)$/i;
  const defaults = {
    userAgent: 'curl/7.68.0'
  }
  // Check if the host matches the combined regex
  if (domainRegex.test(url.host)) {
    url.host = "fxtwitter.com";
    // Return the modified URL and directive to not follow redirects
    return {...defaults, url, redirect: 'manual' };
  }

  // If the URL does not match the regex, return the original URL
  // and directive to follow redirects as usual
  return {...defaults, url, redirect: 'follow' };
}

/**
* Extracts YouTube video ID from URL.
*/
function getYoutubeVideoID(url: URL): string | null {
  const regExp =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.href.match(regExp);
  return match ? match[1] : null;
}

/**
* Handles HTML content, converting it to Markdown.
*/
async function htmlToMarkdown(html: string, url: URL): Promise<string> {
    // Parsing the HTML
    const doc = new JSDOM(html, { url: url.href });

    const updateAttributeToAbsoluteURL = (selector: string, attribute: string) => {
        const elements = document.querySelectorAll(selector);

        elements.forEach((el) => {
            el.setAttribute(
                attribute,
                new URL(el.getAttribute(attribute) as string, url).href
            );
        });
    };
    const document = doc.window.document;

    // Loop through each image and update the src attribute
    updateAttributeToAbsoluteURL("img", "src");

    // Fix all elements with 'href' attributes (typically links)
    updateAttributeToAbsoluteURL("[href]", "href");

    // Update 'content' attributes for 'og:image'  meta tags
    updateAttributeToAbsoluteURL(
        'meta[property="og:image"][content], meta[property="og:image:secure_url"][content]',
        "content"
    );
    const body = document.body;
    const turndownService = new TurndownService();
    // Checking if the page is probably readable, use minContentLength to avoid only showing first article on comment sites
    if (isProbablyReaderable(document, {minContentLength: body.textContent.length / 3})) {
        // Cleaning up the page
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        const markdown = turndownService.turndown(article?.content || "");

        return markdown;
    } else {
        const og = await parseOg(document.documentElement.outerHTML);
        let description = og.ogDescription || "";
        // If not readable, strip script tags and return the text content of the whole page
        for (const badTags of ["script", "style", "link"]) {
            const tags = document.querySelectorAll(badTags);
            tags.forEach((tag) => tag.parentNode?.removeChild(tag));
        }
        const txt = turndownService.turndown(body.innerHTML || "");
        if (description.length < txt.length) {
            // https://arxiv.org/abs/2305.16300 is a good test for this path
            description = txt;
        }
        if (!og.ogTitle) {
            og.ogTitle = document.title;
        }

        const youtubeVideoID = getYoutubeVideoID(url);
        if (youtubeVideoID) {
            const arr = (await getSubtitles({
                videoID: youtubeVideoID,
            })) as { text: string }[];
            description =
                "## Generated Transcription\n\n" +
                arr.map(({ text }) => text).join("\n");
        }
        const md = ogToMarkdown({ ...og, ogDescription: description });
        return md;
    }
}

/**
* Fetches content from a URL and converts it to Markdown.
*/
export async function fetchAndConvertToMarkdown(href: string | URL, fetchFunc: typeof fetch): Promise<string> {
  let response;
  const {redirect, url, userAgent} = scrapeableUrl(href instanceof URL ? href : new URL(href));
  console.log(userAgent)
  try {
    response = await fetchFunc(url, {
      redirect: redirect,
      headers: {
        'User-Agent': userAgent
      }
    });
  } catch (error) {
      console.error("Fetch error:", error instanceof Error ? error.message : "Unknown error");
      throw new Error("Failed to fetch content.");
  }

  if (!response) {
      throw new Error("No response received.");
  }

  if (response.status >= 400) {
      // dump headers and body when error via console.error
      // console.error(response.headers);
      // console.error(await response.text());
      throw new Error(`Response status indicates an error: ${response.status} when fetching ${url}`);
  }

  const contentType = response.headers.get("content-type");
  const binaryContent = await response.arrayBuffer(); // Use ArrayBuffer for both text and binary content
  if (contentType?.includes("application/pdf")) {
      console.debug("PDF file detected");
      // Assuming pdf2md can handle an ArrayBuffer directly or has been adjusted accordingly
      const pdfDataMarkdown = await pdf2md(binaryContent); // Placeholder for actual pdf2md implementation
      console.debug("PDF file extracted", { pdfMarkdownLength: pdfDataMarkdown.length });
      return pdfDataMarkdown;
  } else if (contentType?.includes("text/html")) {
      const html = new TextDecoder("utf-8").decode(binaryContent); // Decode ArrayBuffer to string
      return await htmlToMarkdown(html, url);
  } else {
      // Unsupported content type
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}