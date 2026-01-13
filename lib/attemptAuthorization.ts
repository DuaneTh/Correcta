type AttemptSessionUser = {
    id: string
    role: string
    institutionId?: string | null
}

type AttemptReadContext = {
    sessionUser: AttemptSessionUser
    attemptStudentId: string
    attemptInstitutionId: string | null
    teacherCanAccess: boolean
}

type AttemptAccessAction =
    | 'submitAttempt'
    | 'writeProctorEvents'
    | 'viewAntiCheat'
    | 'enqueueGrading'
    | 'viewResults'
    | 'viewGrading'

const isAdminRole = (role: string) =>
    role === 'ADMIN' || role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN'

export function canReadAttempt({
    sessionUser,
    attemptStudentId,
    attemptInstitutionId,
    teacherCanAccess
}: AttemptReadContext): boolean {
    if (!sessionUser?.id || !sessionUser.institutionId || !attemptInstitutionId) {
        return false
    }

    if (sessionUser.institutionId !== attemptInstitutionId) {
        return false
    }

    if (sessionUser.role === 'STUDENT') {
        return attemptStudentId === sessionUser.id
    }

    if (sessionUser.role === 'TEACHER') {
        return teacherCanAccess
    }

    if (isAdminRole(sessionUser.role)) {
        return true
    }

    return false
}

export function canAccessAttemptAction(
    action: AttemptAccessAction,
    {
        sessionUser,
        attemptStudentId,
        attemptInstitutionId,
        teacherCanAccess
    }: AttemptReadContext
): boolean {
    if (!sessionUser?.id || !sessionUser.institutionId || !attemptInstitutionId) {
        return false
    }

    if (sessionUser.institutionId !== attemptInstitutionId) {
        return false
    }

    switch (action) {
        case 'submitAttempt':
        case 'writeProctorEvents':
            return sessionUser.role === 'STUDENT' && attemptStudentId === sessionUser.id
        case 'viewAntiCheat':
        case 'enqueueGrading':
        case 'viewGrading':
            if (isAdminRole(sessionUser.role)) {
                return true
            }
            return sessionUser.role === 'TEACHER' && teacherCanAccess
        case 'viewResults':
            if (sessionUser.role === 'STUDENT') {
                return attemptStudentId === sessionUser.id
            }
            if (isAdminRole(sessionUser.role)) {
                return true
            }
            return sessionUser.role === 'TEACHER' && teacherCanAccess
        default:
            return false
    }
}
