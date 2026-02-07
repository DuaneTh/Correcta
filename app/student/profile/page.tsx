import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE } from "@/lib/i18n/config"
import { PasswordChangeForm } from "@/components/PasswordChangeForm"

const ROLE_LABELS: Record<string, string> = {
    'STUDENT': 'ÉTUDIANT',
    'TEACHER': 'ENSEIGNANT',
    'ADMIN': 'ADMINISTRATEUR'
}

export default async function StudentProfilePage() {
    const session = await getAuthSession()

    if (!session || !session.user) {
        redirect('/login')
    }

    if (!isStudent(session)) {
        const role = session.user.role
        if (role === 'TEACHER' || role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') {
            redirect('/teacher/courses')
        }
        redirect('/login')
    }

    const roleLabel = ROLE_LABELS[session.user?.role] || session.user?.role
    const cookieStore = await cookies()
    const locale = cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? DEFAULT_LOCALE

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Profil utilisateur</h1>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Profil utilisateur</h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">Détails de votre session.</p>
                    </div>
                    <div className="border-t border-gray-200">
                        <dl>
                            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Nom complet</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{session.user?.name}</dd>
                            </div>
                            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Adresse e-mail</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{session.user?.email}</dd>
                            </div>
                            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Rôle</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{roleLabel}</dd>
                            </div>
                            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Identifiant de l&apos;institution</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{session.user?.institutionId}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <PasswordChangeForm locale={locale} />
            </div>
        </div>
    )
}
