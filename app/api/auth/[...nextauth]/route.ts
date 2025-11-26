import { buildAuthOptions } from "@/lib/auth"
import NextAuth from "next-auth"
import { NextRequest } from "next/server"

async function handler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
    // Extract institution ID from cookie
    const institutionId = req.cookies.get('correcta-institution')?.value

    // We don't strictly need params here, but we must match the signature
    // const { nextauth } = await ctx.params 

    const authOptions = await buildAuthOptions(institutionId)

    // @ts-ignore - NextAuth types are tricky with App Router
    return NextAuth(req, ctx, authOptions)
}

export { handler as GET, handler as POST }
