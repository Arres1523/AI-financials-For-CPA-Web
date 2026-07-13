import { Document, Packer, Paragraph, TextRun } from "docx";
import type { CpaMemoModel } from "../domain/types";

export function buildCpaMemoText(model: CpaMemoModel): string {
  const missing = model.missingDocuments.length ? model.missingDocuments : ["None noted"];
  const open = model.openReviewItems.length ? model.openReviewItems : ["None noted"];

  return [
    `Subject: ${model.llcName} - ${model.taxYear} CPA Package`,
    "",
    `Hi ${model.cpaName},`,
    "",
    `Attached is the CPA package for ${model.llcName} for tax year ${model.taxYear}.`,
    "",
    "Included:",
    ...model.included.map((item) => `- ${item}`),
    "",
    "Missing documents:",
    ...missing.map((item) => `- ${item}`),
    "",
    "Open CPA review items:",
    ...open.map((item) => `- ${item}`),
    "",
    "Notes:",
    "- Valoris did not prepare K-1s.",
    "- Capital contributions and distributions were kept off the P&L.",
    "- The CPA should confirm final tax treatment.",
    "",
    "Thank you,"
  ].join("\n");
}

export async function buildCpaMemoBuffer(model: CpaMemoModel): Promise<Buffer> {
  const paragraphs = buildCpaMemoText(model).split("\n").map((line) => {
    if (line.startsWith("Subject:")) {
      return new Paragraph({ children: [new TextRun({ text: line, bold: true })], spacing: { after: 200 } });
    }
    if (line.endsWith(":")) {
      return new Paragraph({ children: [new TextRun({ text: line, bold: true })], spacing: { before: 160, after: 80 } });
    }
    return new Paragraph({ text: line, spacing: { after: 80 } });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  return Packer.toBuffer(doc);
}
