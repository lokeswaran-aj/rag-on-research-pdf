import axios from "axios";
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
  console.log("🚀 ~ pdfAsBuffer:", pdfAsBuffer)
  
  if (pagesToDelete && pagesToDelete.length > 0) {
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }
}
