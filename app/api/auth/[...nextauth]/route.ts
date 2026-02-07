import { buildAuthOptions } from "@/lib/auth"
import NextAuth from "next-auth"
import { NextRequest } from "next/server"

async function handler(incomingReq: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
    // Extract institution ID from cookie
    const institutionId = incomingReq.cookies.get('correcta-institution')?.value

    // OpenNext/Lambda: req.nextUrl may be missing or incomplete.
    // NextAuth v4 requires req.nextUrl.searchParams.
    // Always construct a proper NextRequest to guarantee nextUrl exists.
    const req = new NextRequest(incomingReq.url, {
        method: incomingReq.method,
        headers: incomingReq.headers,
        body: incomingReq.body,
        duplex: 'half',
    })

    const authOptions = await buildAuthOptions(institutionId)

    return NextAuth(req, ctx, authOptions)
}

export { handler as GET, handler as POST }
