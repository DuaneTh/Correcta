import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const { email } = await req.json()
        console.log(`[API] Lookup request for: ${email}`)

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 })
        }

        const domain = email.split('@')[1]
        console.log(`[API] Domain extracted: ${domain}`)

        // Force CREDENTIALS for demo.edu
        if (domain === 'demo.edu') {
            console.log(`[API] Demo domain detected, forcing credentials`)
            return NextResponse.json({ type: "CREDENTIALS" })
        }

        // Find institution by domain
        const institution = await prisma.institution.findUnique({
            where: { domain }
        })

        if (institution && institution.ssoConfig) {
            console.log(`[API] SSO Institution found: ${institution.name}`)
            return NextResponse.json({
                type: "SSO",
                institutionId: institution.id
            })
        }

        console.log(`[API] No SSO config found, defaulting to credentials`)
        return NextResponse.json({ type: "CREDENTIALS" })
    } catch (error) {
        console.error("Lookup error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
