'use client'

import { useState } from 'react'
import SegmentedMathField from '@/components/exams/SegmentedMathField'
import { ContentSegment } from '@/types/exams'

export default function TestMathEditorPage() {
    const [segments, setSegments] = useState<ContentSegment[]>([
        { id: '1', type: 'text', text: 'Solve the equation: ' },
        { id: '2', type: 'math', latex: 'x^2 + 3x - 4 = 0' },
        { id: '3', type: 'text', text: ' and simplify ' },
        { id: '4', type: 'math', latex: '\\frac{a}{b}' },
    ])

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-gray-900">
                    SegmentedMathField Test
                </h1>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">Editor with Math Toolbar</h2>
                    <SegmentedMathField
                        value={segments}
                        onChange={setSegments}
                        placeholder="Type here, add math formulas..."
                        minRows={3}
                        showMathToolbar={true}
                    />
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">
                        Segments State (Debug)
                    </h2>
                    <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-64">
                        {JSON.stringify(segments, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    )
}

