import axios from "axios";
import { SupabaseDatabase } from "database.js";
import { unlink, writeFile } from "fs/promises";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { formatDocumentsAsString } from "langchain/util/document";
import { PDFDocument } from "pdf-lib";
import { ArxivPaperNote, NOTE_PROMPT, NOTES_TOOL_SCHEMA, outputParser } from "prompt.js";

const deletePages = async (pdf: Buffer, pagesToDelete: number[]): Promise<Buffer> => { 
  const pdfDoc = await PDFDocument.load(pdf)
  let numToOffsetBy = 1
  for (const page of pagesToDelete) {
    pdfDoc.removePage(page - numToOffsetBy);
    numToOffsetBy += 1;
  }
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

const loadPdfFromUrl = async (url: string): Promise<Buffer> => {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  })
  return response.data
}

const convertPdfToDocuments = async (pdf: Buffer): Promise<Array<Document>> => {
  if (!process.env.UNSTRUCTURED_API_KEY) { 
    throw new Error("UNSTRUCTURED_API_KEY not provided.")
  }
  const randomName = Math.random().toString(36).substring(7);
  const tempPdfPath = `pdfs/${randomName}.pdf`
  await writeFile(tempPdfPath, pdf, "binary")
  const loader = new UnstructuredLoader(tempPdfPath, { apiKey: process.env.UNSTRUCTURED_API_KEY, strategy: "hi_res" , apiUrl: "https://api.unstructuredapp.io/general/v0/general"})
  const documents = await loader.load()
  await unlink(tempPdfPath)
  return documents
 }

const generateNotes = async (documents: Array<Document>): Promise<ArxivPaperNote[]> => {
const documentsAsString = formatDocumentsAsString(documents)
const model = new ChatOpenAI({temperature: 0.0, modelName: "gpt-4", openAIApiKey: process.env.OPENAI_API_KEY, })
  const modelWithTool = model.bind({
  tools: [NOTES_TOOL_SCHEMA],
  })
  const chain = NOTE_PROMPT.pipe(modelWithTool).pipe(outputParser)
  const response = await chain.invoke({ paper: documentsAsString })
  return response
}

const main = async ({
  paperUrl,
  name,
  pagesToDelete,
}: {
  paperUrl: string
  name: string
  pagesToDelete?: number[]
}) => {
  console.log("🚀 ~ name:", name)
  if (!paperUrl.endsWith(".pdf")) {
    throw new Error("Not an PDF")
  }
  let pdfAsBuffer = await loadPdfFromUrl(paperUrl)
  
  if (pagesToDelete && pagesToDelete.length > 0) {
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }

  const documents = await convertPdfToDocuments(pdfAsBuffer)
  const notes = await generateNotes(documents)
  console.log("🚀 ~ notes:", notes)
  console.log("🚀 ~ notes length:", notes.length)
  const database = await SupabaseDatabase.fromDocuments(documents)
  await Promise.all([database.addPaper({ paper: formatDocumentsAsString(documents), url: paperUrl, notes, name }), database.vectorStore.addDocuments(documents)])
}

main({paperUrl:"https://arxiv.org/pdf/2410.21549.pdf", name: "test"})
