'use server'

import { getServerSession } from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

/**
 * Promote a teacher to school admin role.
 * Only school admins can promote users in their own institution.
 * Only teachers can be promoted (not students).
 */
export async function promoteToSchoolAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  // Verify caller is school admin
  if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
    return { success: false, error: 'Unauthorized' }
  }

  // Find target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, institutionId: true, name: true, email: true }
  })

  // Verify target user exists and is in same institution
  if (!targetUser) {
    return { success: false, error: 'User not found' }
  }

  if (targetUser.institutionId !== session.user.institutionId) {
    return { success: false, error: 'User not in your institution' }
  }

  // Only teachers can be promoted
  if (targetUser.role !== 'TEACHER') {
    return { success: false, error: 'Can only promote teachers' }
  }

  // Perform the promotion
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'SCHOOL_ADMIN' }
  })

  // Revalidate the users page to reflect the change
  revalidatePath('/admin/school/users')

  return { success: true }
}

/**
 * Demote a school admin back to teacher role.
 * Reserved for future use - currently not exposed in UI.
 * Requires platform admin or special permissions.
 */
export async function demoteToTeacher(userId: string): Promise<{ success: boolean; error?: string }> {
  // Placeholder for future implementation
  // Research recommends: "Allow promotion only; demotion requires platform admin"
  return { success: false, error: 'Demotion not available - contact platform admin' }
}
