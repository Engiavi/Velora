import { DataAPIClient } from "@datastax/astra-db-ts"
import { puppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer"

import OpenAI from "openai"

import "dotenv/config"

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
type SimilarityMetric = "dot_product" |"cosine"| "euclidean"
const {
    DB_NAMESPACE,
    DB_COLLECTION,
    DB_API_ENDPOINT,
    DB_APPLICATION_TOKEN,
    HUGGINGFACE_API
} = process.env

const openai = new OpenAI({apiKey: HUGGINGFACE_API})

const veloraData =[
    "https://segment.com/docs/?ref=nav",
    "https://docs.mparticle.com/",
    "https://docs.lytics.com/",
    "https://docs.zeotap.com/home/en-us/"
]

const client = new DataAPIClient(DB_APPLICATION_TOKEN)
const db = client.db(DB_API_ENDPOINT,{namespace: DB_NAMESPACE})

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:512,
    chunkOverlap: 100
})

const createCollection = async (SimilarityMetric:SimilarityMetric="dot_product") => {
    const res = await db.createCollection(DB_COLLECTION,{
        vector :{
            dimension:1024,
            metric:SimilarityMetric
        }
    })
    console.log(res)
}