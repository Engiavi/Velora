import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { HfInference } from "@huggingface/inference";
import "dotenv/config";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

// Environment variables
const {
    DB_NAMESPACE,
    DB_COLLECTION,
    DB_API_ENDPOINT,
    DB_APPLICATION_TOKEN,
    HF,
} = process.env;

// Initialize Hugging Face Inference API
const hf = new HfInference(HF!);

// Predefined URLs for scraping
const veloraData = [
    "https://segment.com/docs/?ref=nav",
    "https://docs.mparticle.com/",
    "https://docs.lytics.com/",
    "https://docs.zeotap.com/home/en-us/",
];

// Astra DB client and database initialization
const client = new DataAPIClient(DB_APPLICATION_TOKEN!);
const db = client.db(DB_API_ENDPOINT!, { namespace: DB_NAMESPACE! });

// Text splitter configuration
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});

// Create a collection in the vector database
const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    try {
        const res = await db.createCollection(DB_COLLECTION!, {
            vector: {
                dimension: 384, // Adjusted to match the embedding model's output size
                metric: similarityMetric,
            },
        });
        console.log("Collection created:", res);
    } catch (err) {
        console.error("Error creating collection:", err);
    }
};

// Scrape content from a given URL with added retry logic and user-agent spoofing
const scrapePage = async (url: string, visitedUrls: Set<string> = new Set()): Promise<string[]> => {
    if (visitedUrls.has(url)) {
        return []; // Prevent re-scraping the same page
    }
    visitedUrls.add(url);

    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: { 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // For environments like CI/CD
        },
        gotoOptions: { waitUntil: "domcontentloaded" },
    });

    try {
        const content = await loader.scrape();

        // Ensure the content is returned as an array of strings
        if (Array.isArray(content)) {
            return content;
        } else if (typeof content === "string") {
            return [content];
        } else {
            return [];
        }
    } catch (err) {
        console.error(`Error scraping page ${url}:`, err);
        return [];
    }
};


// Load data from URLs, generate embeddings, and insert into the database
const loadSampleData = async () => {
    try {
        const collection = await db.collection(DB_COLLECTION!);

        for (const url of veloraData) {
            console.log(`Scraping content from: ${url}`);
            const contents = await scrapePage(url);

            if (contents.length === 0) {
                console.log(`Skipping URL: ${url} (no content)`);
                continue;
            }

            for (const content of contents) {
                const chunks = await splitter.splitText(content);

                for (const chunk of chunks) {
                    console.log(`Generating embedding for chunk: ${chunk.slice(0, 50)}...`);

                    let embedding;
                    try {
                        embedding = await hf.featureExtraction({
                            model: "sentence-transformers/all-MiniLM-L6-v2", // Model with 384 output dimensions
                            inputs: chunk,
                        });
                    } catch (err) {
                        console.error("Error generating embedding:", err);
                        continue;
                    }

                    if (embedding.length !== 384) {
                        console.error(`Embedding dimension mismatch: expected 384, got ${embedding.length}`);
                        continue;
                    }

                    try {
                        const res = await collection.insertOne({
                            $vector: embedding,
                            text: chunk,
                        });
                        console.log("Inserted document:", res);
                    } catch (err) {
                        console.error("Error inserting document:", err);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error loading sample data:", err);
    }
};

// Main execution flow
(async () => {
    await createCollection();
    await loadSampleData();
})();
