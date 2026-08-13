import { SMTPServer } from "smtp-server";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const port = Number(process.env.MAIL_PORT || process.argv[2] || 2525);
const file = process.env.MAIL_FILE || process.argv[3] || ".local/mail.json";
const messages = [];
async function persist() { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(messages, null, 2)); }
const server = new SMTPServer({
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, callback) {
    const chunks = []; stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", async () => { messages.push({ to: session.envelope.rcptTo.map(item => item.address), raw: Buffer.concat(chunks).toString(), receivedAt: new Date().toISOString() }); await persist(); callback(); });
  },
});
server.listen(port, "127.0.0.1", () => console.log(`Mail capture listening on ${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
