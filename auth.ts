import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { clientPromise } from "@/lib/mongodb";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  // Local defaults allow builds to run; production must supply SMTP settings.
  providers: [Email({ server: process.env.EMAIL_SERVER || "smtp://localhost:1025", from: process.env.EMAIL_FROM || "no-reply@localhost" })],
  pages: { signIn: "/login" },
  trustHost: true,
});
