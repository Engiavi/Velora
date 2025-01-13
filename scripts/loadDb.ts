import puppeteer from "puppeteer-extra";
import { Page } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HfInference } from "@huggingface/inference";
import "dotenv/config";

// Environment variables
const {
  DB_NAMESPACE,
  DB_COLLECTION,
  DB_API_ENDPOINT,
  DB_APPLICATION_TOKEN,
  HF, // Hugging Face token
} = process.env;

// Initialize Hugging Face Inference API
const hf = new HfInference(HF!);

// Initialize Astra DB client
const client = new DataAPIClient(DB_APPLICATION_TOKEN!);
const db = client.db(DB_API_ENDPOINT!, { namespace: DB_NAMESPACE! });

// Puppeteer with stealth mode
puppeteer.use(StealthPlugin());

// Text splitter configuration
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

// URLs to scrape
const urlsToScrape = [
  "https://segment.com/docs/",
  "https://docs.mparticle.com/",
  "https://docs.lytics.com/",
  "https://docs.zeotap.com/home/en-us/",
];

// Create a collection in the vector database
const createCollection = async () => {
  try {
    const response = await db.createCollection(DB_COLLECTION!, {
      vector: { dimension: 384, metric: "cosine" },
    });
    console.log("Collection created:", response);
  } catch (err) {
    console.error("Error creating collection:", err);
  }
};

// Extract all valid links from a page
const extractLinks = async (page: Page): Promise<string[]> => {
  return page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll("a"));
    return allLinks
      .filter((link) => {
        const text = link.innerText.toLowerCase();
        const href = link.href.toLowerCase();
        return (
          !(
            text.includes("login") ||
            text.includes("signup") ||
            text.includes("register") ||
            href.includes("login") ||
            href.includes("signup") ||
            href.includes("register")
          ) && href.startsWith("http")
        );
      })
      .map((link) => link.href);
  });
};

// Scrape the innerText of a page
const scrapePage = async (url: string): Promise<string[]> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log(`Scraping content from ${url}`);
    return await page.evaluate(() => [document.body.innerText.trim()]);
  } catch (err) {
    console.error(`Error scraping page ${url}:`, err);
    return [];
  } finally {
    await browser.close();
  }
};

// Save chunks of text in the database with duplicate prevention
const saveChunks = async (content: string, processedChunks: Set<string>) => {
  const chunks = await splitter.splitText(content);
  const collection = await db.collection(DB_COLLECTION!);

  for (const chunk of chunks) {
    const chunkHash = Buffer.from(chunk).toString("base64");

    if (processedChunks.has(chunkHash)) {
      console.log("Chunk already processed. Skipping...");
      continue;
    }

    const embedding = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: chunk,
    });

    await collection.insertOne({
      _id: chunkHash,
      text: chunk,
      $vector: embedding,
    });

    processedChunks.add(chunkHash);
    console.log("Chunk saved to database.");
  }
};

// Recursive scraping function with improved deduplication
const recursiveScrape = async (
  url: string,
  visitedUrls: Set<string>,
  processedChunks: Set<string>,
  depth: number
) => {
  if (visitedUrls.has(url) || depth === 0) {
    return;
  }

  visitedUrls.add(url);

  const contents = await scrapePage(url);
  for (const content of contents) {
    await saveChunks(content, processedChunks);
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const links = Array.from(new Set(await extractLinks(page)));

    for (const link of links) {
      await recursiveScrape(link, visitedUrls, processedChunks, depth - 1);
    }
  } catch (err) {
    console.error(`Error navigating to ${url}:`, err);
  } finally {
    await browser.close();
  }
};

// Main function
const main = async () => {
  await createCollection();

  const visitedUrls = new Set<string>();
  const processedChunks = new Set<string>();

  for (const url of urlsToScrape) {
    console.log(`Starting scrape for: ${url}`);
    await recursiveScrape(url, visitedUrls, processedChunks, 3); // Adjust depth as needed
  }

  console.log("Scraping and saving completed.");
};

// Execute main function
main().catch((err) => console.error("Error in main execution:", err));
