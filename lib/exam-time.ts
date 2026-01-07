export const MIN_EXAM_START_DATE = new Date('2000-01-01')

type DateInput = Date | string | null | undefined

export const getExamEndAt = (
    startAt: DateInput,
    durationMinutes: number | null | undefined,
    endAt?: DateInput
) => {
    if (endAt) {
        const end = new Date(endAt)
        return Number.isNaN(end.getTime()) ? null : end
    }

    if (!startAt || !durationMinutes || durationMinutes <= 0) {
        return null
    }

    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) {
        return null
    }

    return new Date(start.getTime() + durationMinutes * 60 * 1000)
}
