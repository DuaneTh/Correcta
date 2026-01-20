'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'

type CsvUploaderProps = {
  onParsed: (data: Record<string, string>[], errors: string[]) => void
  requiredColumns: string[]
  optionalColumns?: string[]
  accept?: string
  maxRows?: number
  labels: {
    dropzone: string
    selectFile: string
    parsing: string
    invalidFormat: string
    missingColumns: string
    tooManyRows: string
  }
}

export default function CsvUploader({
  onParsed,
  requiredColumns,
  optionalColumns = [],
  accept = '.csv',
  maxRows = 500,
  labels,
}: CsvUploaderProps) {
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File | null) => {
    if (!file) return

    setParsing(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false)

        const errors: string[] = []
        const headers = results.meta.fields || []

        // Check required columns
        const missingCols = requiredColumns.filter(col => !headers.includes(col))
        if (missingCols.length > 0) {
          onParsed([], [`${labels.missingColumns}: ${missingCols.join(', ')}`])
          return
        }

        // Check row limit
        if (results.data.length > maxRows) {
          onParsed([], [`${labels.tooManyRows}: ${results.data.length} (max: ${maxRows})`])
          return
        }

        // Collect parse errors
        results.errors.forEach(err => {
          errors.push(`Row ${err.row}: ${err.message}`)
        })

        onParsed(results.data as Record<string, string>[], errors)
      },
      error: () => {
        setParsing(false)
        onParsed([], [labels.invalidFormat])
      }
    })
  }, [onParsed, requiredColumns, maxRows, labels])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] || null)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
        dragOver ? 'border-brand-900 bg-brand-50' : 'border-gray-300'
      }`}
    >
      {parsing ? (
        <p className="text-sm text-gray-500">{labels.parsing}</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-2">{labels.dropzone}</p>
          <label className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 cursor-pointer">
            {labels.selectFile}
            <input
              type="file"
              accept={accept}
              onChange={handleChange}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400 mt-2">
            {requiredColumns.length > 0 && `Required: ${requiredColumns.join(', ')}`}
            {optionalColumns.length > 0 && ` | Optional: ${optionalColumns.join(', ')}`}
          </p>
        </>
      )}
    </div>
  )
}
