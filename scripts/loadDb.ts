import { DataAPIClient } from "@datastax/astra-db-ts"
import { puppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer"

import OpenAI from "openai"

import "dotenv/config"

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
type SimilarityMetric = "dot_product" | "cosine" | "euclidean"
const {
    DB_NAMESPACE,
    DB_COLLECTION,
    DB_API_ENDPOINT,
    DB_APPLICATION_TOKEN,
    HUGGINGFACE_API
} = process.env

const openai = new OpenAI({ apiKey: HUGGINGFACE_API })

const veloraData = [
    "https://segment.com/docs/?ref=nav",
    "https://docs.mparticle.com/",
    "https://docs.lytics.com/",
    "https://docs.zeotap.com/home/en-us/"
]

const client = new DataAPIClient(DB_APPLICATION_TOKEN)
const db = client.db(DB_API_ENDPOINT, { namespace: DB_NAMESPACE })

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const createCollection = async (SimilarityMetric: SimilarityMetric = "dot_product") => {
    const res = await db.createCollection(DB_COLLECTION, {
        vector: {
            dimension: 1024,
            metric: SimilarityMetric
        }
    })
    console.log(res)
}
const loadSampleData = async () => {
    const collection = await db.collection(DB_COLLECTION)
    for await (const url of veloraData) {
        const content =await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await (const chunk of chunks) {
            const embedding = await openai.embeddings.create({
                model: "text-embeddings-3-small",
                input: chunk,
                encoding_format: "float"
            })
            const vector = embedding.data[0].embedding
            const res = await collection.insertOne({
                $vector :vector,
                text: chunk
            })
            console.log(res)
        }
    }
}

const scrapePage = async (url: string) => {
    const loader = new puppeteerWebBaseLoader(url,{
        launchOptions: {
            headless: true
        },
        gotoOptions:{
            waitUntil: "domcontentloaded"
        },
        evaluate:async(page,browser)=>{
           const result =  await page.evaluate(()=>document.body.innerHTML)
           await browser.close()
           return result;
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, "")
}