import fs from "node:fs";
import path from "node:path";
import { PdfReader } from "pdf-parse";

const pdfPath = process.argv[2] ?? "C:\\Users\\Aleja\\Downloads\\SquadLists-Spanish.pdf";
const buf = fs.readFileSync(pdfPath);
const reader = new PdfReader();
const result = await reader.parse(buf);
const out = path.join(process.cwd(), "scripts", "squadlists.txt");
fs.writeFileSync(out, result.text, "utf8");
console.log("Saved", result.text.length, "chars to", out);
console.log("Pages:", result.numpages);
