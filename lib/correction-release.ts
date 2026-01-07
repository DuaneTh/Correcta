import { getExamEndAt } from '@/lib/exam-time'

type CorrectionReleaseConfig = Record<string, unknown> | null | undefined

type CorrectionReleaseInfo = {
    releaseOnEnd: boolean
    releaseAt: Date | null
    gradesReleased: boolean
    gradesReleasedAt: Date | null
    endAt: Date | null
    isReleased: boolean
    canSendManually: boolean
}

export function getCorrectionReleaseInfo(params: {
    gradingConfig: CorrectionReleaseConfig
    startAt: Date | string | null
    durationMinutes: number | null
    endAt?: Date | string | null
    now?: Date
}): CorrectionReleaseInfo {
    const {
        gradingConfig,
        startAt,
        durationMinutes,
        endAt,
        now = new Date(),
    } = params

    const releaseOnEnd = gradingConfig?.correctionReleaseOnEnd === true
    const releaseAtRaw = typeof gradingConfig?.correctionReleaseAt === 'string' ? gradingConfig.correctionReleaseAt : null
    const releaseAt = releaseAtRaw ? new Date(releaseAtRaw) : null
    const gradesReleased = gradingConfig?.gradesReleased === true
    const gradesReleasedAtRaw = typeof gradingConfig?.gradesReleasedAt === 'string' ? gradingConfig.gradesReleasedAt : null
    const gradesReleasedAt = gradesReleasedAtRaw ? new Date(gradesReleasedAtRaw) : null

    const startDate = startAt ? new Date(startAt) : null
    const endDateOverride = endAt ? new Date(endAt) : null
    const computedEndAt = startDate ? getExamEndAt(startDate, durationMinutes, endDateOverride) : null

    const scheduledReached =
        (releaseOnEnd && computedEndAt && now >= computedEndAt) ||
        (releaseAt && now >= releaseAt)

    const isReleased = gradesReleased || Boolean(gradesReleasedAt) || scheduledReached
    const canSendManually = Boolean(computedEndAt && now >= computedEndAt && !isReleased)

    return {
        releaseOnEnd,
        releaseAt,
        gradesReleased,
        gradesReleasedAt,
        endAt: computedEndAt,
        isReleased,
        canSendManually,
    }
}
