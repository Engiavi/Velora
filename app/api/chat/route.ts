import { DataAPIClient } from "@datastax/astra-db-ts";
import { pipeline } from "@huggingface/transformers";
import { Readable } from "stream";

const {
    DB_NAMESPACE,
    DB_COLLECTION,
    DB_API_ENDPOINT,
    DB_APPLICATION_TOKEN,
    HF,
} = process.env;

// Initialize Hugging Face pipeline
const embeddingPipeline = await pipeline("feature-extraction", "sentence-transformers/all-MiniLM-L6-v2"); // Use Hugging Face model for embeddings

const client = new DataAPIClient(DB_APPLICATION_TOKEN!);
const db = client.db(DB_API_ENDPOINT!, { namespace: DB_NAMESPACE! });

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const latestMessage = messages[messages.length - 1]?.content; // Extract the latest user message
        let docContext = "";

        // console.log("Received message:", latestMessage);

        // Generate embedding using Hugging Face model
        const embeddings = await embeddingPipeline(latestMessage);
        const embedding = embeddings[0][0]; // Use the first embedding
        // console.log("Generated embedding:", embedding);

        // Convert tensor to a plain array
        const embeddingArray = Array.from(embedding); // Flatten the tensor to an array
        // console.log("Embedding as array:", embeddingArray);

        try {
            const collection = await db.collection(DB_COLLECTION!);
            // console.log("Querying DB collection:", DB_COLLECTION);
            const cursor = collection.find(null, {
                sort: {
                    $vector: embeddingArray as number[] // Add type assertion to the $vector property
                },
                limit: 10
            });
            const documents = await cursor.toArray();
            console.log("Documents found:", documents);

            const docsMap = documents?.map(doc => doc.text);
            docContext = JSON.stringify(docsMap);
            console.log("Document context:", docContext);
        } catch (e) {
            console.log("Error querying DB:", e);
            docContext = "";
        }

        // Now, the question is included as a "user" message in the Hugging Face API call.
        const template = {
            role: "system",
            content: `
                You are an AI assistant who knows everything about these websites.
                Use the below context to augment what you know about these websites.
                The context will provide you with the most recent.
                --------------------------------------------------
                Start of context
                ${docContext}
                End of context
                --------------------------------------------------
                Question: ${latestMessage}
                `
        };

        console.log("Sending to Hugging Face API with context:", docContext);

        // Now, pass the user's question as the message input
        const response = await fetch(
            "https://api-inference.huggingface.co/models/distilbert/distilgpt2", // RAG model URL for response generation
            {
                headers: {
                    Authorization: `Bearer ${HF}`, // Hugging Face API token
                    "Content-Type": "application/json"
                },
                method: "POST",
                body: JSON.stringify({
                    inputs: [template, ...messages] // Context for the question
                })
            }
        );
        
        const result = await response.json();
        console.log("Hugging Face response:", result);

        const generatedText = result?.generated_text || "Sorry, I couldn't generate a response.";
        console.log("Generated text:", generatedText);

        // Convert the response to a readable stream
        const stream = new Readable();
        stream.push(generatedText);
        stream.push(null);

        const body = new ReadableStream({
            start(controller) {
                stream.on("data", (chunk) => controller.enqueue(chunk));
                stream.on("end", () => controller.close());
                stream.on("error", (err) => controller.error(err));
            },
        });

        return new Response(body, { headers: { "Content-Type": "text/plain" } });
    } catch (e) {
        console.error("Error handling request:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
}
