import axios from "axios";
import { unlink, writeFile } from "fs/promises";
import { Document } from "langchain/document";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { PDFDocument } from "pdf-lib";

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

const main = async ({
  paperUrl,
  name,
  pagesToDelete,
}: {
  paperUrl: string
  name: string
  pagesToDelete?: number[]
}) => {
  if (!paperUrl.endsWith(".pdf")) {
    throw new Error("Not an PDF")
  }
  let pdfAsBuffer = await loadPdfFromUrl(paperUrl)
  
  if (pagesToDelete && pagesToDelete.length > 0) {
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }

  const documents = await convertPdfToDocuments(pdfAsBuffer)
}

main({paperUrl:"https://arxiv.org/pdf/2410.21549.pdf", name: "test"})
