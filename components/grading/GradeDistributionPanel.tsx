'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BarChart3, Sliders, AlertTriangle, Check, Undo2, TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'

interface GradeData {
    attemptId: string
    studentName: string
    originalScore: number
    currentScore: number
    maxPoints: number
}

interface GradeDistributionPanelProps {
    examId: string
    grades: GradeData[]
    maxPoints: number
    onHarmonizationApplied: () => void
}

type HarmonizationMethod =
    | 'bonus'
    | 'linear'
    | 'curve_average'
    | 'sqrt'
    | 'floor'
    | 'ceiling'

interface HarmonizationPreview {
    method: HarmonizationMethod
    params: Record<string, number>
    previewScores: { attemptId: string; newScore: number }[]
    stats: {
        oldAvg: number
        newAvg: number
        oldMin: number
        newMin: number
        oldMax: number
        newMax: number
        oldStdDev: number
        newStdDev: number
    }
}

// Calculate standard deviation
function calculateStdDev(scores: number[], avg: number): number {
    if (scores.length === 0) return 0
    const squaredDiffs = scores.map(s => Math.pow(s - avg, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length
    return Math.sqrt(avgSquaredDiff)
}

// Round to nearest 0.25
function roundToQuarter(value: number): number {
    return Math.round(value * 4) / 4
}

// Component to show change with arrow
function ChangeIndicator({ oldValue, newValue, suffix = '' }: { oldValue: number; newValue: number; suffix?: string }) {
    const diff = newValue - oldValue
    const absDiff = Math.abs(diff)

    if (Math.abs(diff) < 0.01) {
        return (
            <span className="inline-flex items-center gap-1 text-gray-500">
                <Minus className="w-4 h-4" />
                <span className="font-bold">{newValue.toFixed(2)}{suffix}</span>
            </span>
        )
    }

    if (diff > 0) {
        return (
            <span className="inline-flex items-center gap-1 text-green-700">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold">{newValue.toFixed(2)}{suffix}</span>
                <span className="text-xs bg-green-100 px-1.5 py-0.5 rounded-full font-semibold">
                    +{absDiff.toFixed(2)}
                </span>
            </span>
        )
    }

    return (
        <span className="inline-flex items-center gap-1 text-red-600">
            <TrendingDown className="w-4 h-4" />
            <span className="font-bold">{newValue.toFixed(2)}{suffix}</span>
            <span className="text-xs bg-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                -{absDiff.toFixed(2)}
            </span>
        </span>
    )
}

export function GradeDistributionPanel({
    examId,
    grades,
    maxPoints,
    onHarmonizationApplied
}: GradeDistributionPanelProps) {
    const [thresholdValue, setThresholdValue] = useState(maxPoints / 2)
    const [isDragging, setIsDragging] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<HarmonizationMethod>('bonus')
    const [methodParams, setMethodParams] = useState<Record<string, number>>({
        bonus: 0,
        targetAverage: maxPoints / 2,
        minScore: 0,
        maxScore: maxPoints,
        scaleFactor: 1
    })
    const [preview, setPreview] = useState<HarmonizationPreview | null>(null)
    const [isApplying, setIsApplying] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)

    // Rescaling state
    const [targetScale, setTargetScale] = useState(maxPoints)
    const [showRescaleConfirm, setShowRescaleConfirm] = useState(false)
    const [isRescaling, setIsRescaling] = useState(false)

    // Calculate histogram bins (original and preview)
    const { bins, previewBins, binWidth, gradeMovements } = useMemo(() => {
        const numBins = Math.min(10, Math.ceil(maxPoints))
        const binW = maxPoints / numBins

        // Original bins (current scores)
        const originalBins: { min: number; max: number; count: number; grades: GradeData[] }[] = []
        // Preview bins (after harmonization)
        const prevBins: { min: number; max: number; count: number; grades: GradeData[] }[] = []

        for (let i = 0; i < numBins; i++) {
            originalBins.push({
                min: i * binW,
                max: (i + 1) * binW,
                count: 0,
                grades: []
            })
            prevBins.push({
                min: i * binW,
                max: (i + 1) * binW,
                count: 0,
                grades: []
            })
        }

        // Track movements between bins for arrows
        const movements: { fromBin: number; toBin: number; count: number }[] = []
        const movementMap = new Map<string, number>()

        grades.forEach(g => {
            // Original bin
            const origBinIndex = Math.min(Math.floor(g.currentScore / binW), numBins - 1)
            if (origBinIndex >= 0 && origBinIndex < originalBins.length) {
                originalBins[origBinIndex].count++
                originalBins[origBinIndex].grades.push(g)
            }

            // Preview bin (if harmonization active)
            const newScore = preview?.previewScores.find(p => p.attemptId === g.attemptId)?.newScore ?? g.currentScore
            const newBinIndex = Math.min(Math.floor(newScore / binW), numBins - 1)
            if (newBinIndex >= 0 && newBinIndex < prevBins.length) {
                prevBins[newBinIndex].count++
                prevBins[newBinIndex].grades.push(g)
            }

            // Track movement if bins differ
            if (preview && origBinIndex !== newBinIndex) {
                const key = `${origBinIndex}-${newBinIndex}`
                movementMap.set(key, (movementMap.get(key) || 0) + 1)
            }
        })

        // Convert movement map to array
        movementMap.forEach((count, key) => {
            const [from, to] = key.split('-').map(Number)
            movements.push({ fromBin: from, toBin: to, count })
        })

        return {
            bins: originalBins,
            previewBins: prevBins,
            binWidth: binW,
            gradeMovements: movements
        }
    }, [grades, maxPoints, preview])

    // Calculate stats including standard deviation
    const stats = useMemo(() => {
        const scores = grades.map(g =>
            preview?.previewScores.find(p => p.attemptId === g.attemptId)?.newScore ?? g.currentScore
        )
        const originalScores = grades.map(g => g.currentScore)

        if (scores.length === 0) return null

        const sum = scores.reduce((a, b) => a + b, 0)
        const avg = sum / scores.length
        const min = Math.min(...scores)
        const max = Math.max(...scores)
        const stdDev = calculateStdDev(scores, avg)

        const origSum = originalScores.reduce((a, b) => a + b, 0)
        const origAvg = origSum / originalScores.length
        const origStdDev = calculateStdDev(originalScores, origAvg)

        // Count above/below threshold
        const aboveThreshold = scores.filter(s => s >= thresholdValue).length
        const belowThreshold = scores.filter(s => s < thresholdValue).length

        return {
            avg,
            min,
            max,
            stdDev,
            origAvg,
            origStdDev,
            aboveThreshold,
            belowThreshold,
            total: scores.length
        }
    }, [grades, thresholdValue, preview])

    // Calculate preview when method or params change
    const calculatePreview = useCallback(() => {
        if (grades.length === 0) return

        const previewScores: { attemptId: string; newScore: number }[] = []
        const currentScores = grades.map(g => g.currentScore)
        const currentAvg = currentScores.reduce((a, b) => a + b, 0) / currentScores.length
        const currentMin = Math.min(...currentScores)
        const currentMax = Math.max(...currentScores)
        const currentStdDev = calculateStdDev(currentScores, currentAvg)

        grades.forEach(g => {
            let newScore = g.currentScore

            switch (selectedMethod) {
                case 'bonus':
                    newScore = Math.min(Math.max(0, g.currentScore + methodParams.bonus), maxPoints)
                    break
                case 'linear':
                    newScore = Math.min(g.currentScore * methodParams.scaleFactor, maxPoints)
                    break
                case 'curve_average':
                    const targetAvg = methodParams.targetAverage
                    const adjustment = targetAvg - currentAvg
                    newScore = Math.max(0, Math.min(g.currentScore + adjustment, maxPoints))
                    break
                case 'sqrt':
                    newScore = Math.sqrt(g.currentScore / maxPoints) * maxPoints
                    break
                case 'floor':
                    newScore = Math.max(g.currentScore, methodParams.minScore)
                    break
                case 'ceiling':
                    newScore = Math.min(g.currentScore, methodParams.maxScore)
                    break
            }

            previewScores.push({
                attemptId: g.attemptId,
                newScore: roundToQuarter(newScore)
            })
        })

        const newScores = previewScores.map(p => p.newScore)
        const newAvg = newScores.reduce((a, b) => a + b, 0) / newScores.length
        const newMin = Math.min(...newScores)
        const newMax = Math.max(...newScores)
        const newStdDev = calculateStdDev(newScores, newAvg)

        setPreview({
            method: selectedMethod,
            params: { ...methodParams },
            previewScores,
            stats: {
                oldAvg: currentAvg,
                newAvg,
                oldMin: currentMin,
                newMin,
                oldMax: currentMax,
                newMax,
                oldStdDev: currentStdDev,
                newStdDev
            }
        })
    }, [grades, selectedMethod, methodParams, maxPoints])

    useEffect(() => {
        calculatePreview()
    }, [calculatePreview])

    // Handle threshold dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !chartRef.current) return
            const rect = chartRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = Math.max(0, Math.min(1, x / rect.width))
            setThresholdValue(Math.round(percentage * maxPoints * 10) / 10)
        }

        const handleMouseUp = () => setIsDragging(false)

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, maxPoints])

    // Apply harmonization
    const handleApply = async () => {
        if (!preview) return
        setIsApplying(true)
        setError(null)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/harmonize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    method: selectedMethod,
                    params: methodParams,
                    scores: preview.previewScores
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Erreur lors de l\'harmonisation')
            }

            setShowConfirm(false)
            setPreview(null)
            onHarmonizationApplied()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setIsApplying(false)
        }
    }

    // Calculate rescaled scores preview
    const rescalePreview = useMemo(() => {
        if (targetScale === maxPoints || grades.length === 0) return null

        const rescaledScores = grades.map(g => ({
            attemptId: g.attemptId,
            originalScore: g.currentScore,
            newScore: roundToQuarter((g.currentScore / maxPoints) * targetScale)
        }))

        const newScores = rescaledScores.map(s => s.newScore)
        const newAvg = newScores.reduce((a, b) => a + b, 0) / newScores.length
        const newMin = Math.min(...newScores)
        const newMax = Math.max(...newScores)

        return {
            scores: rescaledScores,
            newAvg,
            newMin,
            newMax
        }
    }, [grades, maxPoints, targetScale])

    // Apply rescaling
    const handleRescale = async () => {
        if (!rescalePreview) return
        setIsRescaling(true)
        setError(null)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/harmonize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    method: 'rescale',
                    params: { fromScale: maxPoints, toScale: targetScale },
                    scores: rescalePreview.scores.map(s => ({
                        attemptId: s.attemptId,
                        newScore: s.newScore
                    }))
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Erreur lors du changement d\'echelle')
            }

            setShowRescaleConfirm(false)
            onHarmonizationApplied()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setIsRescaling(false)
        }
    }

    const maxBinCount = Math.max(
        ...bins.map(b => b.count),
        ...(preview ? previewBins.map(b => b.count) : []),
        1
    )

    const getMethodLabel = (method: HarmonizationMethod) => {
        switch (method) {
            case 'bonus': return 'Ajouter des points bonus'
            case 'linear': return 'Mise a l\'echelle lineaire'
            case 'curve_average': return 'Ajuster vers moyenne cible'
            case 'sqrt': return 'Transformation racine carree'
            case 'floor': return 'Definir un score minimum'
            case 'ceiling': return 'Definir un score maximum'
        }
    }

    const hasChanges = preview && preview.previewScores.some(
        p => {
            const original = grades.find(g => g.attemptId === p.attemptId)
            return original && Math.abs(original.currentScore - p.newScore) > 0.01
        }
    )

    // Y-axis labels for chart
    const yAxisLabels = [maxBinCount, Math.round(maxBinCount / 2), 0]

    if (grades.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Repartition des notes</h3>
                </div>
                <p className="text-gray-500 text-center py-8">
                    Aucune note disponible. Corrigez d&apos;abord les copies.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Repartition des notes</h3>
                </div>
                {preview && hasChanges && (
                    <span className="text-sm text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                        Apercu des modifications
                    </span>
                )}
            </div>

            {/* Current distribution chart */}
            <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                    Distribution actuelle
                </div>
                <div className="flex">
                    {/* Y-axis */}
                    <div className="flex flex-col justify-between pr-2 text-right w-8" style={{ height: '160px' }}>
                        {yAxisLabels.map((label, i) => (
                            <span key={i} className="text-xs font-medium text-gray-600 leading-none">{label}</span>
                        ))}
                    </div>

                    {/* Chart area */}
                    <div className="flex-1">
                        <div
                            ref={chartRef}
                            className="relative bg-white border-l-2 border-b-2 border-gray-400"
                            style={{ height: '160px' }}
                        >
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                <div className="border-b border-dashed border-gray-300 w-full" />
                                <div className="border-b border-dashed border-gray-300 w-full" />
                            </div>

                            {/* Histogram bars */}
                            <div className="absolute inset-0 flex items-end">
                                {bins.map((bin, index) => {
                                    const barHeight = (bin.count / maxBinCount) * 100
                                    const isAboveThreshold = bin.min >= thresholdValue
                                    const isBelowThreshold = bin.max <= thresholdValue

                                    return (
                                        <div
                                            key={index}
                                            className="flex-1 h-full relative"
                                        >
                                            <div
                                                className={`absolute bottom-0 left-0.5 right-0.5 rounded-t-sm transition-all duration-300 border border-b-0 ${
                                                    isAboveThreshold
                                                        ? 'bg-green-500 border-green-600'
                                                        : isBelowThreshold
                                                            ? 'bg-red-400 border-red-500'
                                                            : 'bg-indigo-500 border-indigo-600'
                                                }`}
                                                style={{
                                                    height: `${barHeight}%`,
                                                    minHeight: bin.count > 0 ? '4px' : '0'
                                                }}
                                                title={`${bin.min.toFixed(1)} - ${bin.max.toFixed(1)}: ${bin.count} copie${bin.count > 1 ? 's' : ''}`}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Average line */}
                            {stats && (
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-indigo-700 z-20 pointer-events-none"
                                    style={{ left: `${(stats.origAvg / maxPoints) * 100}%` }}
                                >
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-indigo-700 text-white text-xs font-bold rounded whitespace-nowrap">
                                        Moy: {stats.origAvg.toFixed(1)}
                                    </div>
                                </div>
                            )}

                            {/* Threshold line */}
                            <div
                                className="absolute top-0 bottom-0 w-1 bg-gray-800 cursor-ew-resize z-10 hover:bg-gray-600"
                                style={{ left: `${(thresholdValue / maxPoints) * 100}%` }}
                                onMouseDown={handleMouseDown}
                            >
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-gray-800 rounded-full border-2 border-white shadow-lg cursor-ew-resize flex items-center justify-center">
                                    <div className="w-1 h-2 bg-white rounded-full" />
                                </div>
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-xs font-bold rounded whitespace-nowrap">
                                    {thresholdValue.toFixed(1)} pts
                                </div>
                            </div>
                        </div>

                        {/* X-axis labels */}
                        <div className="flex justify-between mt-2 text-xs font-medium text-gray-600">
                            <span>0</span>
                            <span>{(maxPoints * 0.25).toFixed(0)}</span>
                            <span>{(maxPoints * 0.5).toFixed(0)}</span>
                            <span>{(maxPoints * 0.75).toFixed(0)}</span>
                            <span>{maxPoints}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview chart (shown when harmonization preview is active) */}
            {preview && hasChanges && (
                <div className="mb-4">
                    {/* Movement arrows between charts */}
                    <div className="relative h-12 ml-8">
                        <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                            <defs>
                                <marker
                                    id="arrowhead-down-green"
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="4"
                                    refY="8"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 8 0, 4 8" fill="#16a34a" />
                                </marker>
                                <marker
                                    id="arrowhead-down-red"
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="4"
                                    refY="8"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 8 0, 4 8" fill="#dc2626" />
                                </marker>
                            </defs>
                            {gradeMovements.map((movement, idx) => {
                                const numBins = bins.length
                                const fromX = ((movement.fromBin + 0.5) / numBins) * 100
                                const toX = ((movement.toBin + 0.5) / numBins) * 100
                                const isIncrease = movement.toBin > movement.fromBin

                                return (
                                    <g key={idx}>
                                        {/* Curved arrow from top chart to bottom chart */}
                                        <path
                                            d={`M ${fromX}% 0 Q ${(fromX + toX) / 2}% 50% ${toX}% 100%`}
                                            fill="none"
                                            stroke={isIncrease ? '#16a34a' : '#dc2626'}
                                            strokeWidth="2"
                                            markerEnd={`url(#arrowhead-down-${isIncrease ? 'green' : 'red'})`}
                                        />
                                        {/* Count label */}
                                        <text
                                            x={`${(fromX + toX) / 2}%`}
                                            y="50%"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            className="text-xs font-bold"
                                            fill={isIncrease ? '#16a34a' : '#dc2626'}
                                            style={{ transform: `translateX(${isIncrease ? '8px' : '-8px'})` }}
                                        >
                                            {movement.count}
                                        </text>
                                    </g>
                                )
                            })}
                        </svg>
                    </div>

                    <div className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                        <span>Apres harmonisation</span>
                        <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                            Apercu
                        </span>
                    </div>
                    <div className="flex">
                        {/* Y-axis */}
                        <div className="flex flex-col justify-between pr-2 text-right w-8" style={{ height: '160px' }}>
                            {yAxisLabels.map((label, i) => (
                                <span key={i} className="text-xs font-medium text-gray-600 leading-none">{label}</span>
                            ))}
                        </div>

                        {/* Chart area */}
                        <div className="flex-1">
                            <div
                                className="relative bg-amber-50 border-l-2 border-b-2 border-amber-400"
                                style={{ height: '160px' }}
                            >
                                {/* Grid lines */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                    <div className="border-b border-dashed border-amber-200 w-full" />
                                    <div className="border-b border-dashed border-amber-200 w-full" />
                                </div>

                                {/* Histogram bars */}
                                <div className="absolute inset-0 flex items-end">
                                    {previewBins.map((bin, index) => {
                                        const barHeight = (bin.count / maxBinCount) * 100

                                        // Calculate average point change for grades in this bin
                                        let avgPointChange = 0
                                        if (bin.grades.length > 0 && preview) {
                                            const totalChange = bin.grades.reduce((sum, g) => {
                                                const newScore = preview.previewScores.find(p => p.attemptId === g.attemptId)?.newScore ?? g.currentScore
                                                return sum + (newScore - g.currentScore)
                                            }, 0)
                                            avgPointChange = totalChange / bin.grades.length
                                        }

                                        return (
                                            <div
                                                key={index}
                                                className="flex-1 h-full relative"
                                            >
                                                <div
                                                    className="absolute bottom-0 left-0.5 right-0.5 rounded-t-sm transition-all duration-300 border border-b-0 bg-amber-400 border-amber-500"
                                                    style={{
                                                        height: `${barHeight}%`,
                                                        minHeight: bin.count > 0 ? '4px' : '0'
                                                    }}
                                                    title={`${bin.min.toFixed(1)} - ${bin.max.toFixed(1)}: ${bin.count} copie${bin.count > 1 ? 's' : ''}`}
                                                />
                                                {/* Show point change indicator inside bar */}
                                                {bin.count > 0 && Math.abs(avgPointChange) >= 0.01 && (
                                                    <div
                                                        className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-bold px-1 py-0.5 rounded whitespace-nowrap z-10 ${
                                                            avgPointChange > 0
                                                                ? 'text-green-800 bg-green-200/90'
                                                                : 'text-red-700 bg-red-200/90'
                                                        }`}
                                                        style={{
                                                            bottom: barHeight > 15
                                                                ? `${barHeight - 12}%`
                                                                : `${barHeight + 2}%`
                                                        }}
                                                    >
                                                        {avgPointChange > 0 ? '+' : ''}{avgPointChange.toFixed(1)}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* New average line */}
                                {stats && preview && (
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-amber-700 z-20 pointer-events-none"
                                        style={{ left: `${(preview.stats.newAvg / maxPoints) * 100}%` }}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-amber-700 text-white text-xs font-bold rounded whitespace-nowrap z-30">
                                            Moy: {preview.stats.newAvg.toFixed(1)}
                                        </div>
                                    </div>
                                )}

                                {/* Threshold line (same position) */}
                                <div
                                    className="absolute top-0 bottom-0 w-1 bg-gray-800 z-10 opacity-50"
                                    style={{ left: `${(thresholdValue / maxPoints) * 100}%` }}
                                />
                            </div>

                            {/* X-axis labels */}
                            <div className="flex justify-between mt-2 text-xs font-medium text-gray-600">
                                <span>0</span>
                                <span>{(maxPoints * 0.25).toFixed(0)}</span>
                                <span>{(maxPoints * 0.5).toFixed(0)}</span>
                                <span>{(maxPoints * 0.75).toFixed(0)}</span>
                                <span>{maxPoints}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Threshold stats */}
            {stats && (
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-700">{stats.aboveThreshold}</div>
                        <div className="text-sm font-medium text-gray-700">
                            Au-dessus de {thresholdValue.toFixed(1)} pts
                        </div>
                        <div className="text-xs text-gray-600">
                            ({Math.round(stats.aboveThreshold / stats.total * 100)}% des copies)
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.belowThreshold}</div>
                        <div className="text-sm font-medium text-gray-700">
                            En-dessous de {thresholdValue.toFixed(1)} pts
                        </div>
                        <div className="text-xs text-gray-600">
                            ({Math.round(stats.belowThreshold / stats.total * 100)}% des copies)
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics with standard deviation */}
            {stats && (
                <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="text-center p-3 bg-indigo-100 rounded-lg border border-indigo-200">
                        <div className="text-lg font-bold text-indigo-800">
                            {stats.avg.toFixed(2)}
                        </div>
                        <div className="text-xs font-semibold text-indigo-700">Moyenne</div>
                        {preview && hasChanges && (
                            <div className="text-xs text-indigo-600 mt-1">
                                (etait {stats.origAvg.toFixed(2)})
                            </div>
                        )}
                    </div>
                    <div className="text-center p-3 bg-purple-100 rounded-lg border border-purple-200">
                        <div className="text-lg font-bold text-purple-800">
                            {stats.stdDev.toFixed(2)}
                        </div>
                        <div className="text-xs font-semibold text-purple-700">Ecart-type</div>
                        {preview && hasChanges && (
                            <div className="text-xs text-purple-600 mt-1">
                                (etait {stats.origStdDev.toFixed(2)})
                            </div>
                        )}
                    </div>
                    <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
                        <div className="text-lg font-bold text-red-800">{stats.min.toFixed(2)}</div>
                        <div className="text-xs font-semibold text-red-700">Minimum</div>
                    </div>
                    <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                        <div className="text-lg font-bold text-green-800">{stats.max.toFixed(2)}</div>
                        <div className="text-xs font-semibold text-green-700">Maximum</div>
                    </div>
                </div>
            )}

            {/* Harmonization section */}
            <div className="border-t-2 border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-lg font-bold text-gray-900">Harmonisation des notes</h4>
                </div>

                {/* Method selector */}
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                        Methode d&apos;harmonisation
                    </label>
                    <select
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value as HarmonizationMethod)}
                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="bonus">{getMethodLabel('bonus')}</option>
                        <option value="linear">{getMethodLabel('linear')}</option>
                        <option value="curve_average">{getMethodLabel('curve_average')}</option>
                        <option value="sqrt">{getMethodLabel('sqrt')}</option>
                        <option value="floor">{getMethodLabel('floor')}</option>
                        <option value="ceiling">{getMethodLabel('ceiling')}</option>
                    </select>
                </div>

                {/* Method-specific parameters */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {selectedMethod === 'bonus' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Points bonus a ajouter
                            </label>
                            <input
                                type="number"
                                value={methodParams.bonus}
                                onChange={(e) => setMethodParams(p => ({ ...p, bonus: parseFloat(e.target.value) || 0 }))}
                                step="0.5"
                                min={-maxPoints}
                                max={maxPoints}
                                className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-sm text-gray-700 mt-2">
                                Valeur negative pour retirer des points. Exemple: +2 ajoute 2 points a toutes les notes.
                            </p>
                        </div>
                    )}

                    {selectedMethod === 'linear' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Facteur d&apos;echelle (multiplicateur)
                            </label>
                            <input
                                type="number"
                                value={methodParams.scaleFactor}
                                onChange={(e) => setMethodParams(p => ({ ...p, scaleFactor: parseFloat(e.target.value) || 1 }))}
                                step="0.1"
                                min="0.1"
                                max="3"
                                className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-sm text-gray-700 mt-2">
                                1.0 = pas de changement, 1.1 = +10%, 0.9 = -10%. Chaque note est multipliee par ce facteur.
                            </p>
                        </div>
                    )}

                    {selectedMethod === 'curve_average' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Moyenne cible
                            </label>
                            <input
                                type="number"
                                value={methodParams.targetAverage}
                                onChange={(e) => setMethodParams(p => ({ ...p, targetAverage: parseFloat(e.target.value) || 0 }))}
                                step="0.5"
                                min="0"
                                max={maxPoints}
                                className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-sm text-gray-700 mt-2">
                                Toutes les notes seront ajustees uniformement pour atteindre cette moyenne.
                                Moyenne actuelle: <strong>{stats?.origAvg.toFixed(2)}</strong>
                            </p>
                        </div>
                    )}

                    {selectedMethod === 'sqrt' && (
                        <div className="text-gray-800">
                            <p className="font-medium mb-2">Transformation racine carree</p>
                            <p className="text-sm">
                                Cette methode compresse les notes elevees et etire les notes basses.
                                Elle preserve l&apos;ordre des notes tout en reduisant l&apos;ecart entre les meilleurs et les moins bons.
                            </p>
                            <p className="text-sm mt-2">
                                Formule: <code className="bg-gray-200 px-1 rounded">nouvelle_note = sqrt(note/max) * max</code>
                            </p>
                        </div>
                    )}

                    {selectedMethod === 'floor' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Score minimum garanti
                            </label>
                            <input
                                type="number"
                                value={methodParams.minScore}
                                onChange={(e) => setMethodParams(p => ({ ...p, minScore: parseFloat(e.target.value) || 0 }))}
                                step="0.5"
                                min="0"
                                max={maxPoints}
                                className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-sm text-gray-700 mt-2">
                                Toutes les notes inferieures a cette valeur seront remontees a ce minimum.
                            </p>
                        </div>
                    )}

                    {selectedMethod === 'ceiling' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Score maximum autorise
                            </label>
                            <input
                                type="number"
                                value={methodParams.maxScore}
                                onChange={(e) => setMethodParams(p => ({ ...p, maxScore: parseFloat(e.target.value) || maxPoints }))}
                                step="0.5"
                                min="0"
                                max={maxPoints}
                                className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-sm text-gray-700 mt-2">
                                Toutes les notes superieures a cette valeur seront plafonnees a ce maximum.
                            </p>
                        </div>
                    )}
                </div>

                {/* Preview stats */}
                {preview && hasChanges && (
                    <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <span className="text-sm font-bold text-amber-800">
                                Apercu des modifications
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                                <span className="block text-gray-600 text-xs font-medium mb-1">Moyenne</span>
                                <div className="text-gray-400 text-xs mb-1">{preview.stats.oldAvg.toFixed(2)} →</div>
                                <ChangeIndicator oldValue={preview.stats.oldAvg} newValue={preview.stats.newAvg} />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                                <span className="block text-gray-600 text-xs font-medium mb-1">Ecart-type</span>
                                <div className="text-gray-400 text-xs mb-1">{preview.stats.oldStdDev.toFixed(2)} →</div>
                                <ChangeIndicator oldValue={preview.stats.oldStdDev} newValue={preview.stats.newStdDev} />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                                <span className="block text-gray-600 text-xs font-medium mb-1">Minimum</span>
                                <div className="text-gray-400 text-xs mb-1">{preview.stats.oldMin.toFixed(2)} →</div>
                                <ChangeIndicator oldValue={preview.stats.oldMin} newValue={preview.stats.newMin} />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                                <span className="block text-gray-600 text-xs font-medium mb-1">Maximum</span>
                                <div className="text-gray-400 text-xs mb-1">{preview.stats.oldMax.toFixed(2)} →</div>
                                <ChangeIndicator oldValue={preview.stats.oldMax} newValue={preview.stats.newMax} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 rounded-lg text-red-800 font-medium text-sm">
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setMethodParams({
                                bonus: 0,
                                targetAverage: maxPoints / 2,
                                minScore: 0,
                                maxScore: maxPoints,
                                scaleFactor: 1
                            })
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-gray-800 font-medium bg-gray-200 rounded-lg hover:bg-gray-300 border border-gray-300"
                    >
                        <Undo2 className="w-4 h-4" />
                        Reinitialiser
                    </button>
                    <button
                        onClick={() => setShowConfirm(true)}
                        disabled={!hasChanges || isApplying}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-colors ${
                            hasChanges && !isApplying
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        <Check className="w-4 h-4" />
                        Appliquer l&apos;harmonisation
                    </button>
                </div>
            </div>

            {/* Rescaling section */}
            <div className="border-t-2 border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Scale className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-lg font-bold text-gray-900">Changement d&apos;echelle</h4>
                </div>

                <p className="text-sm text-gray-700 mb-4">
                    Convertir les notes d&apos;une echelle a une autre par regle de trois.
                    Actuellement les notes sont sur <strong>{maxPoints}</strong> points.
                </p>

                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                        Nouvelle echelle (note sur)
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            value={targetScale}
                            onChange={(e) => setTargetScale(parseFloat(e.target.value) || maxPoints)}
                            step="1"
                            min="1"
                            className="flex-1 px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-gray-600 font-medium">points</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                        {[10, 20, 100].filter(v => v !== maxPoints).map(preset => (
                            <button
                                key={preset}
                                onClick={() => setTargetScale(preset)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                                    targetScale === preset
                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                /{preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rescale preview */}
                {rescalePreview && (
                    <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                        <div className="text-sm font-bold text-blue-800 mb-3">
                            Apercu: {maxPoints} pts → {targetScale} pts
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                <span className="block text-gray-600 text-xs font-medium">Moyenne</span>
                                <span className="font-bold text-blue-700">{rescalePreview.newAvg.toFixed(2)}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                <span className="block text-gray-600 text-xs font-medium">Min</span>
                                <span className="font-bold text-blue-700">{rescalePreview.newMin.toFixed(2)}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                <span className="block text-gray-600 text-xs font-medium">Max</span>
                                <span className="font-bold text-blue-700">{rescalePreview.newMax.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-blue-700">
                            Exemple: {grades[0]?.currentScore.toFixed(2)}/{maxPoints} → {rescalePreview.scores[0]?.newScore.toFixed(2)}/{targetScale}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setShowRescaleConfirm(true)}
                    disabled={!rescalePreview || isRescaling}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-colors ${
                        rescalePreview && !isRescaling
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    <Scale className="w-4 h-4" />
                    Appliquer le changement d&apos;echelle
                </button>
            </div>

            {/* Harmonization confirmation modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowConfirm(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Confirmer l&apos;harmonisation
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Vous etes sur le point d&apos;appliquer l&apos;harmonisation &quot;{getMethodLabel(selectedMethod)}&quot;
                            a <strong>{grades.length}</strong> copie{grades.length > 1 ? 's' : ''}.
                        </p>
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-4">
                            <p className="text-sm text-amber-900 font-medium">
                                <strong>Attention:</strong> Cette action modifiera les notes de toutes les copies.
                                Les anciennes notes seront conservees dans l&apos;historique.
                            </p>
                        </div>
                        {preview && (
                            <div className="text-sm text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">
                                <div>Nouvelle moyenne: <strong className="text-indigo-700">{preview.stats.newAvg.toFixed(2)}</strong> pts</div>
                                <div className="text-gray-600">(actuellement {preview.stats.oldAvg.toFixed(2)} pts)</div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 text-gray-800 font-medium bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={isApplying}
                                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                                    isApplying
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                            >
                                {isApplying ? 'Application...' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rescale confirmation modal */}
            {showRescaleConfirm && rescalePreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowRescaleConfirm(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Confirmer le changement d&apos;echelle
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Vous etes sur le point de convertir les notes de <strong>{maxPoints}</strong> points
                            vers <strong>{targetScale}</strong> points pour <strong>{grades.length}</strong> copie{grades.length > 1 ? 's' : ''}.
                        </p>
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-900 font-medium">
                                Formule: <code className="bg-blue-100 px-1 rounded">nouvelle_note = (ancienne_note / {maxPoints}) × {targetScale}</code>
                            </p>
                        </div>
                        <div className="text-sm text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">
                            <div>Nouvelle moyenne: <strong className="text-blue-700">{rescalePreview.newAvg.toFixed(2)}</strong> / {targetScale}</div>
                            <div>Min: {rescalePreview.newMin.toFixed(2)} | Max: {rescalePreview.newMax.toFixed(2)}</div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRescaleConfirm(false)}
                                className="px-4 py-2 text-gray-800 font-medium bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleRescale}
                                disabled={isRescaling}
                                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                                    isRescaling
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                            >
                                {isRescaling ? 'Application...' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
