import { fetchAndConvertToMarkdown } from "./src";

(async () => {
  try {
      const markdown = await fetchAndConvertToMarkdown(process.argv[2], fetch);
      console.log(markdown);
  } catch (error) {
      console.error("Error:", error.message);
  }
})();