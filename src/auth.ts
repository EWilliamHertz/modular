import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { query } from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await query('SELECT * FROM users WHERE email = $1', [credentials.email as string]);
        const user = res.rows[0];
        
        // Auto-register the user if they do not exist
        if (!user) {
          const hash = await bcrypt.hash(credentials.password as string, 10);
          const insert = await query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *', [credentials.email, hash]);
          return { id: insert.rows[0].id.toString(), email: insert.rows[0].email };
        }
        
        // Validate existing user
        const isValid = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (isValid) return { id: user.id.toString(), email: user.email };
        return null;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
})