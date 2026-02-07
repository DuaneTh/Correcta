'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { X, Upload, Users, GraduationCap, AlertCircle, CheckCircle, FileSpreadsheet, Layers, Plus, Trash2, Pencil, Check } from 'lucide-react'
import type { PersonRow, CourseRow, SectionRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Stack, Inline } from '@/components/ui/Layout'
import { Input, Textarea, Select } from '@/components/ui/Form'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

type CourseFormModalProps = {
    open: boolean
    onClose: () => void
    onSave: (course: CourseRow, defaultSectionId?: string) => void
    institutionId: string
    teachers: PersonRow[]
    existingStudents: PersonRow[]
    existingSections?: SectionRow[]
    editCourse?: CourseRow | null
    dict: {
        createCourseTitle: string
        editCourseTitle: string
        courseCodePlaceholder: string
        courseNamePlaceholder: string
        cancelArchiveButton: string
        confirmArchiveButton: string
        createCourseButton: string
        saveButton: string
        saveError: string
        saving: string
        searchTeachersPlaceholder: string
        emptyTeachers: string
        classes: {
            noValidStudentsInFile: string
            deleteSectionConfirm: string
            emptyTeachersDropdown: string
            noAdditionalSections: string
            noSectionsForCourse: string
        }
    }
}

type CsvStudent = {
    email: string
    name?: string
    status: 'pending' | 'exists' | 'new' | 'invalid'
    existingId?: string
}

type SectionCsvStudent = {
    email: string
    name?: string
    status: 'exists' | 'new' | 'invalid'
    existingId?: string
}

type SectionToCreate = {
    id: string // temporary id for React key
    name: string
    parentId?: string // for subgroups
    teacherIds: string[]
    studentIds: string[] // existing students selected via checkbox
    csvStudents: SectionCsvStudent[] // students imported via CSV
}

export default function CourseFormModal({
    open,
    onClose,
    onSave,
    institutionId,
    teachers,
    existingStudents,
    existingSections = [],
    editCourse,
    dict
}: CourseFormModalProps) {
    const [code, setCode] = useState(editCourse?.code || '')
    const [name, setName] = useState(editCourse?.name || '')
    const [description, setDescription] = useState('')
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set())
    const [teacherSearch, setTeacherSearch] = useState('')
    const [csvStudents, setCsvStudents] = useState<CsvStudent[]>([])
    const [csvError, setCsvError] = useState('')
    const [sectionsToCreate, setSectionsToCreate] = useState<SectionToCreate[]>([])
    const [newSectionName, setNewSectionName] = useState('')
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null)
    // State for editing/deleting existing sections
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
    const [editingSectionName, setEditingSectionName] = useState('')
    const [deletedSectionIds, setDeletedSectionIds] = useState<Set<string>>(new Set())
    const [renamedSections, setRenamedSections] = useState<Map<string, string>>(new Map())
    const [expandedExistingSectionId, setExpandedExistingSectionId] = useState<string | null>(null)
    // Confirmation dialog for deleting a section
    const [sectionToDelete, setSectionToDelete] = useState<{ id: string; name: string } | null>(null)
    // Track enrollment changes for existing sections: Map<sectionId, { addedTeachers, removedTeachers, addedStudents, removedStudents, csvStudents }>
    const [sectionEnrollmentChanges, setSectionEnrollmentChanges] = useState<Map<string, {
        addedTeacherIds: Set<string>
        removedTeacherIds: Set<string>
        addedStudentIds: Set<string>
        removedStudentIds: Set<string>
        csvStudents: SectionCsvStudent[]
    }>>(new Map())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<'info' | 'sections' | 'teachers' | 'students'>('info')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Reset form when modal opens or edit course changes
    useEffect(() => {
        if (open) {
            setCode(editCourse?.code || '')
            setName(editCourse?.name || '')
            setDescription('')
            setSelectedTeacherIds(new Set())
            setCsvStudents([])
            setCsvError('')
            setSectionsToCreate([])
            setNewSectionName('')
            setExpandedSectionId(null)
            setEditingSectionId(null)
            setEditingSectionName('')
            setDeletedSectionIds(new Set())
            setRenamedSections(new Map())
            setExpandedExistingSectionId(null)
            setSectionToDelete(null)
            setSectionEnrollmentChanges(new Map())
            setError('')
            setActiveTab('info')
        }
    }, [open, editCourse])

    const filteredTeachers = useMemo(() => {
        if (!teacherSearch.trim()) return teachers
        const query = teacherSearch.toLowerCase()
        return teachers.filter(t =>
            t.name?.toLowerCase().includes(query) ||
            t.email?.toLowerCase().includes(query)
        )
    }, [teachers, teacherSearch])

    // Existing sections for the course being edited (excluding __DEFAULT__ and deleted ones)
    const courseExistingSections = useMemo(() => {
        if (!editCourse) return []
        return existingSections.filter(s =>
            s.course.id === editCourse.id &&
            s.name !== '__DEFAULT__' &&
            !s.archivedAt &&
            !deletedSectionIds.has(s.id)
        )
    }, [editCourse, existingSections, deletedSectionIds])

    const toggleTeacher = (teacherId: string) => {
        setSelectedTeacherIds(prev => {
            const next = new Set(prev)
            if (next.has(teacherId)) {
                next.delete(teacherId)
            } else {
                next.add(teacherId)
            }
            return next
        })
    }

    const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setCsvError('')
        const reader = new FileReader()

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const lines = text.split(/\r?\n/).filter(line => line.trim())

                if (lines.length === 0) {
                    setCsvError('Le fichier CSV est vide')
                    return
                }

                // Try to detect header
                const firstLine = lines[0].toLowerCase()
                const hasHeader = firstLine.includes('email') || firstLine.includes('mail') || firstLine.includes('nom')
                const dataLines = hasHeader ? lines.slice(1) : lines

                const students: CsvStudent[] = []
                const existingEmails = new Map(existingStudents.map(s => [s.email?.toLowerCase(), s]))

                for (const line of dataLines) {
                    // Support both comma and semicolon as separators
                    const parts = line.includes(';') ? line.split(';') : line.split(',')
                    const email = parts[0]?.trim().toLowerCase()
                    const studentName = parts[1]?.trim() || undefined

                    if (!email) continue

                    // Validate email format
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailRegex.test(email)) {
                        students.push({ email, name: studentName, status: 'invalid' })
                        continue
                    }

                    // Check if student already exists
                    const existing = existingEmails.get(email)
                    if (existing) {
                        students.push({
                            email,
                            name: studentName || existing.name || undefined,
                            status: 'exists',
                            existingId: existing.id
                        })
                    } else {
                        students.push({ email, name: studentName, status: 'new' })
                    }
                }

                if (students.length === 0) {
                    setCsvError(dict.classes.noValidStudentsInFile)
                    return
                }

                setCsvStudents(students)
            } catch {
                setCsvError('Erreur lors de la lecture du fichier CSV')
            }
        }

        reader.onerror = () => {
            setCsvError('Erreur lors de la lecture du fichier')
        }

        reader.readAsText(file)

        // Reset input so same file can be uploaded again
        event.target.value = ''
    }, [existingStudents])

    const removeStudent = (email: string) => {
        setCsvStudents(prev => prev.filter(s => s.email !== email))
    }

    const addSection = () => {
        const trimmedName = newSectionName.trim()
        if (!trimmedName) return
        // Check if already exists in new sections to create
        if (sectionsToCreate.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
            return
        }
        // Check if already exists in existing sections (for edit mode)
        if (courseExistingSections.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
            return
        }
        const newSection: SectionToCreate = {
            id: `temp-${Date.now()}`,
            name: trimmedName,
            teacherIds: [],
            studentIds: [],
            csvStudents: [],
        }
        setSectionsToCreate(prev => [...prev, newSection])
        setNewSectionName('')
        // Auto-expand the new section for enrollment
        setExpandedSectionId(newSection.id)
    }

    const removeSection = (id: string) => {
        setSectionsToCreate(prev => prev.filter(s => s.id !== id))
        if (expandedSectionId === id) {
            setExpandedSectionId(null)
        }
    }

    const toggleSectionTeacher = (sectionId: string, teacherId: string) => {
        setSectionsToCreate(prev => prev.map(s => {
            if (s.id !== sectionId) return s
            const has = s.teacherIds.includes(teacherId)
            return {
                ...s,
                teacherIds: has
                    ? s.teacherIds.filter(id => id !== teacherId)
                    : [...s.teacherIds, teacherId]
            }
        }))
    }

    const toggleSectionStudent = (sectionId: string, studentId: string) => {
        setSectionsToCreate(prev => prev.map(s => {
            if (s.id !== sectionId) return s
            const has = s.studentIds.includes(studentId)
            return {
                ...s,
                studentIds: has
                    ? s.studentIds.filter(id => id !== studentId)
                    : [...s.studentIds, studentId]
            }
        }))
    }

    const handleSectionCsvUpload = (sectionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const lines = text.split(/\r?\n/).filter(line => line.trim())

                if (lines.length === 0) return

                // Detect header
                const firstLine = lines[0].toLowerCase()
                const hasHeader = firstLine.includes('email') || firstLine.includes('mail') || firstLine.includes('nom')
                const dataLines = hasHeader ? lines.slice(1) : lines

                const existingEmails = new Map(existingStudents.map(s => [s.email?.toLowerCase(), s]))
                const students: SectionCsvStudent[] = []

                for (const line of dataLines) {
                    const parts = line.includes(';') ? line.split(';') : line.split(',')
                    const email = parts[0]?.trim().toLowerCase()
                    const studentName = parts[1]?.trim() || undefined

                    if (!email) continue

                    // Validate email
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailRegex.test(email)) {
                        students.push({ email, name: studentName, status: 'invalid' })
                        continue
                    }

                    // Check if exists
                    const existing = existingEmails.get(email)
                    if (existing) {
                        students.push({
                            email,
                            name: studentName || existing.name || undefined,
                            status: 'exists',
                            existingId: existing.id
                        })
                    } else {
                        students.push({ email, name: studentName, status: 'new' })
                    }
                }

                setSectionsToCreate(prev => prev.map(s => {
                    if (s.id !== sectionId) return s
                    // Merge with existing CSV students, avoiding duplicates
                    const existingEmails = new Set(s.csvStudents.map(cs => cs.email))
                    const newStudents = students.filter(st => !existingEmails.has(st.email))
                    return {
                        ...s,
                        csvStudents: [...s.csvStudents, ...newStudents]
                    }
                }))
            } catch (err) {
                console.error('CSV parse error:', err)
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    const removeSectionCsvStudent = (sectionId: string, email: string) => {
        setSectionsToCreate(prev => prev.map(s => {
            if (s.id !== sectionId) return s
            return {
                ...s,
                csvStudents: s.csvStudents.filter(cs => cs.email !== email)
            }
        }))
    }

    const clearSectionCsvStudents = (sectionId: string) => {
        setSectionsToCreate(prev => prev.map(s => {
            if (s.id !== sectionId) return s
            return { ...s, csvStudents: [] }
        }))
    }

    // Functions for editing existing sections
    const startEditingSection = (sectionId: string, currentName: string) => {
        setEditingSectionId(sectionId)
        setEditingSectionName(currentName)
    }

    const cancelEditingSection = () => {
        setEditingSectionId(null)
        setEditingSectionName('')
    }

    const saveEditingSection = () => {
        if (!editingSectionId || !editingSectionName.trim()) return
        setRenamedSections(prev => {
            const next = new Map(prev)
            next.set(editingSectionId, editingSectionName.trim())
            return next
        })
        setEditingSectionId(null)
        setEditingSectionName('')
    }

    const askDeleteExistingSection = (sectionId: string, sectionName: string) => {
        setSectionToDelete({ id: sectionId, name: sectionName })
    }

    const confirmDeleteExistingSection = () => {
        if (!sectionToDelete) return
        setDeletedSectionIds(prev => {
            const next = new Set(prev)
            next.add(sectionToDelete.id)
            return next
        })
        setSectionToDelete(null)
    }

    const cancelDeleteExistingSection = () => {
        setSectionToDelete(null)
    }

    const getSectionDisplayName = (section: SectionRow) => {
        return renamedSections.get(section.id) || section.name
    }

    // Get or create enrollment changes for an existing section (must use prevMap from updater)
    const getOrCreateEnrollmentChanges = (prevMap: Map<string, {
        addedTeacherIds: Set<string>
        removedTeacherIds: Set<string>
        addedStudentIds: Set<string>
        removedStudentIds: Set<string>
        csvStudents: SectionCsvStudent[]
    }>, sectionId: string) => {
        const existing = prevMap.get(sectionId)
        if (existing) {
            // Return a deep copy to avoid mutating the original
            return {
                addedTeacherIds: new Set(existing.addedTeacherIds),
                removedTeacherIds: new Set(existing.removedTeacherIds),
                addedStudentIds: new Set(existing.addedStudentIds),
                removedStudentIds: new Set(existing.removedStudentIds),
                csvStudents: [...existing.csvStudents]
            }
        }
        return {
            addedTeacherIds: new Set<string>(),
            removedTeacherIds: new Set<string>(),
            addedStudentIds: new Set<string>(),
            removedStudentIds: new Set<string>(),
            csvStudents: [] as SectionCsvStudent[]
        }
    }

    // Toggle teacher enrollment for existing section
    const toggleExistingSectionTeacher = (sectionId: string, teacherId: string, isCurrentlyEnrolled: boolean) => {
        setSectionEnrollmentChanges(prev => {
            const next = new Map(prev)
            const changes = getOrCreateEnrollmentChanges(prev, sectionId)

            if (isCurrentlyEnrolled) {
                // Currently enrolled - toggle removal
                if (changes.removedTeacherIds.has(teacherId)) {
                    changes.removedTeacherIds.delete(teacherId)
                } else {
                    changes.removedTeacherIds.add(teacherId)
                }
            } else {
                // Not currently enrolled - toggle addition
                if (changes.addedTeacherIds.has(teacherId)) {
                    changes.addedTeacherIds.delete(teacherId)
                } else {
                    changes.addedTeacherIds.add(teacherId)
                }
            }

            next.set(sectionId, changes)
            return next
        })
    }

    // Toggle student enrollment for existing section
    const toggleExistingSectionStudent = (sectionId: string, studentId: string, isCurrentlyEnrolled: boolean) => {
        setSectionEnrollmentChanges(prev => {
            const next = new Map(prev)
            const changes = getOrCreateEnrollmentChanges(prev, sectionId)

            if (isCurrentlyEnrolled) {
                if (changes.removedStudentIds.has(studentId)) {
                    changes.removedStudentIds.delete(studentId)
                } else {
                    changes.removedStudentIds.add(studentId)
                }
            } else {
                if (changes.addedStudentIds.has(studentId)) {
                    changes.addedStudentIds.delete(studentId)
                } else {
                    changes.addedStudentIds.add(studentId)
                }
            }

            next.set(sectionId, changes)
            return next
        })
    }

    // Handle CSV upload for existing section
    const handleExistingSectionCsvUpload = (sectionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const lines = text.split(/\r?\n/).filter(line => line.trim())
                if (lines.length === 0) return

                const firstLine = lines[0].toLowerCase()
                const hasHeader = firstLine.includes('email') || firstLine.includes('mail') || firstLine.includes('nom')
                const dataLines = hasHeader ? lines.slice(1) : lines

                const existingEmailsMap = new Map(existingStudents.map(s => [s.email?.toLowerCase(), s]))
                const students: SectionCsvStudent[] = []

                for (const line of dataLines) {
                    const parts = line.includes(';') ? line.split(';') : line.split(',')
                    const email = parts[0]?.trim().toLowerCase()
                    const studentName = parts[1]?.trim() || undefined
                    if (!email) continue

                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailRegex.test(email)) {
                        students.push({ email, name: studentName, status: 'invalid' })
                        continue
                    }

                    const existing = existingEmailsMap.get(email)
                    if (existing) {
                        students.push({
                            email,
                            name: studentName || existing.name || undefined,
                            status: 'exists',
                            existingId: existing.id
                        })
                    } else {
                        students.push({ email, name: studentName, status: 'new' })
                    }
                }

                setSectionEnrollmentChanges(prev => {
                    const next = new Map(prev)
                    const changes = getOrCreateEnrollmentChanges(prev, sectionId)
                    const existingEmails = new Set(changes.csvStudents.map(cs => cs.email))
                    const newStudents = students.filter(st => !existingEmails.has(st.email))
                    changes.csvStudents = [...changes.csvStudents, ...newStudents]
                    next.set(sectionId, changes)
                    return next
                })
            } catch (err) {
                console.error('CSV parse error:', err)
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    const removeExistingSectionCsvStudent = (sectionId: string, email: string) => {
        setSectionEnrollmentChanges(prev => {
            const next = new Map(prev)
            const changes = getOrCreateEnrollmentChanges(prev, sectionId)
            changes.csvStudents = changes.csvStudents.filter(cs => cs.email !== email)
            next.set(sectionId, changes)
            return next
        })
    }

    const clearExistingSectionCsvStudents = (sectionId: string) => {
        setSectionEnrollmentChanges(prev => {
            const next = new Map(prev)
            const changes = getOrCreateEnrollmentChanges(prev, sectionId)
            changes.csvStudents = []
            next.set(sectionId, changes)
            return next
        })
    }

    // Check if a teacher is enrolled in a section (considering pending changes)
    const isTeacherInExistingSection = (section: SectionRow, teacherId: string) => {
        const isCurrentlyEnrolled = section.enrollments.some(e => e.user.id === teacherId && e.role === 'TEACHER')
        const changes = sectionEnrollmentChanges.get(section.id)
        if (!changes) return isCurrentlyEnrolled

        if (isCurrentlyEnrolled) {
            return !changes.removedTeacherIds.has(teacherId)
        } else {
            return changes.addedTeacherIds.has(teacherId)
        }
    }

    // Check if a student is enrolled in a section (considering pending changes)
    const isStudentInExistingSection = (section: SectionRow, studentId: string) => {
        const isCurrentlyEnrolled = section.enrollments.some(e => e.user.id === studentId && e.role === 'STUDENT')
        const changes = sectionEnrollmentChanges.get(section.id)
        if (!changes) return isCurrentlyEnrolled

        if (isCurrentlyEnrolled) {
            return !changes.removedStudentIds.has(studentId)
        } else {
            return changes.addedStudentIds.has(studentId)
        }
    }

    // Get enrollment counts for existing section (considering changes)
    const getExistingSectionCounts = (section: SectionRow) => {
        const changes = sectionEnrollmentChanges.get(section.id)
        const currentTeachers = section.enrollments.filter(e => e.role === 'TEACHER')
        const currentStudents = section.enrollments.filter(e => e.role === 'STUDENT')

        let teacherCount = currentTeachers.length
        let studentCount = currentStudents.length

        if (changes) {
            teacherCount = teacherCount - changes.removedTeacherIds.size + changes.addedTeacherIds.size
            studentCount = studentCount - changes.removedStudentIds.size + changes.addedStudentIds.size + changes.csvStudents.filter(s => s.status !== 'invalid').length
        }

        return { teacherCount, studentCount }
    }

    const handleSave = async () => {
        if (!code.trim() || !name.trim()) {
            setError('Le code et le nom du cours sont requis')
            setActiveTab('info')
            return
        }

        setSaving(true)
        setError('')

        try {
            // 1. Create or update the course
            let courseResult: CourseRow
            let defaultSectionId: string | undefined

            if (editCourse) {
                const result = await fetchJsonWithCsrf<{ course?: CourseRow }>(
                    '/api/admin/school/courses',
                    {
                        method: 'PATCH',
                        body: {
                            courseId: editCourse.id,
                            code: code.trim(),
                            name: name.trim()
                        }
                    }
                )
                // Use editCourse.id as fallback since PATCH might not return full course
                courseResult = result?.course || { ...editCourse, code: code.trim(), name: name.trim() }
            } else {
                const result = await fetchJsonWithCsrf<{ course?: CourseRow; defaultSectionId?: string }>(
                    '/api/admin/school/courses',
                    {
                        method: 'POST',
                        body: {
                            institutionId,
                            code: code.trim(),
                            name: name.trim()
                        }
                    }
                )
                if (!result?.course) throw new Error('Failed to create course')
                courseResult = result.course
                defaultSectionId = result.defaultSectionId
            }

            // 2. Delete sections marked for deletion (true deletion, not archiving)
            if (deletedSectionIds.size > 0) {
                for (const sectionId of deletedSectionIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/sections', {
                            method: 'DELETE',
                            body: { sectionId }
                        })
                    } catch (err) {
                        console.error('Failed to delete section:', sectionId, err)
                    }
                }
            }

            // 3. Rename sections that were changed
            if (renamedSections.size > 0) {
                for (const [sectionId, newName] of renamedSections) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/sections', {
                            method: 'PATCH',
                            body: { sectionId, name: newName }
                        })
                    } catch (err) {
                        console.error('Failed to rename section:', sectionId, err)
                    }
                }
            }

            // 3.5 Apply enrollment changes for existing sections
            for (const [sectionId, changes] of sectionEnrollmentChanges) {
                // Remove teachers (ignore 404 - means already removed)
                for (const teacherId of changes.removedTeacherIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                            method: 'DELETE',
                            body: { userId: teacherId, classId: sectionId }
                        })
                    } catch (err) {
                        // 404 means enrollment doesn't exist, which is the desired state
                        if (!(err instanceof Error && err.message.includes('404'))) {
                            console.error('Failed to remove teacher from section:', teacherId, err)
                        }
                    }
                }

                // Add teachers (ignore duplicates)
                for (const teacherId of changes.addedTeacherIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                            method: 'POST',
                            body: {
                                userId: teacherId,
                                courseId: courseResult.id,
                                classId: sectionId,
                                role: 'TEACHER'
                            }
                        })
                    } catch (err) {
                        // Ignore if already enrolled
                        if (!(err instanceof Error && err.message.includes('duplicate'))) {
                            console.error('Failed to add teacher to section:', teacherId, err)
                        }
                    }
                }

                // Remove students (ignore 404 - means already removed)
                for (const studentId of changes.removedStudentIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                            method: 'DELETE',
                            body: { userId: studentId, classId: sectionId }
                        })
                    } catch (err) {
                        // 404 means enrollment doesn't exist, which is the desired state
                        if (!(err instanceof Error && err.message.includes('404'))) {
                            console.error('Failed to remove student from section:', studentId, err)
                        }
                    }
                }

                // Add students
                for (const studentId of changes.addedStudentIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                            method: 'POST',
                            body: {
                                userId: studentId,
                                courseId: courseResult.id,
                                classId: sectionId,
                                role: 'STUDENT'
                            }
                        })
                    } catch (err) {
                        console.error('Failed to add student to section:', studentId, err)
                    }
                }

                // Process CSV students for existing section
                for (const csvStudent of changes.csvStudents) {
                    if (csvStudent.status === 'invalid') continue

                    try {
                        let studentUserId: string | undefined

                        if (csvStudent.status === 'exists' && csvStudent.existingId) {
                            studentUserId = csvStudent.existingId
                        } else if (csvStudent.status === 'new') {
                            // Create new student
                            const userResult = await fetchJsonWithCsrf<{ user?: { id: string } }>(
                                '/api/admin/school/users',
                                {
                                    method: 'POST',
                                    body: {
                                        email: csvStudent.email,
                                        name: csvStudent.name,
                                        role: 'STUDENT',
                                        institutionId
                                    }
                                }
                            )
                            studentUserId = userResult?.user?.id
                        }

                        if (studentUserId) {
                            await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                method: 'POST',
                                body: {
                                    userId: studentUserId,
                                    courseId: courseResult.id,
                                    classId: sectionId,
                                    role: 'STUDENT'
                                }
                            })
                        }
                    } catch (err) {
                        console.error('Failed to process CSV student for existing section:', csvStudent.email, err)
                    }
                }
            }

            // 4. Create additional sections and enroll assigned users
            if (sectionsToCreate.length > 0) {
                for (const section of sectionsToCreate) {
                    try {
                        const sectionResult = await fetchJsonWithCsrf<{ section?: { id: string } }>(
                            '/api/admin/school/sections',
                            {
                                method: 'POST',
                                body: {
                                    courseId: courseResult.id,
                                    name: section.name,
                                }
                            }
                        )

                        const newSectionId = sectionResult?.section?.id
                        if (newSectionId) {
                            // Enroll assigned teachers
                            for (const teacherId of section.teacherIds) {
                                try {
                                    await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                        method: 'POST',
                                        body: {
                                            userId: teacherId,
                                            courseId: courseResult.id,
                                            classId: newSectionId,
                                            role: 'TEACHER'
                                        }
                                    })
                                } catch (err) {
                                    console.error('Failed to enroll teacher in section:', teacherId, err)
                                }
                            }

                            // Enroll assigned students (from checkbox selection)
                            for (const studentId of section.studentIds) {
                                try {
                                    await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                        method: 'POST',
                                        body: {
                                            userId: studentId,
                                            courseId: courseResult.id,
                                            classId: newSectionId,
                                            role: 'STUDENT'
                                        }
                                    })
                                } catch (err) {
                                    console.error('Failed to enroll student in section:', studentId, err)
                                }
                            }

                            // Process CSV students for this section
                            for (const csvStudent of section.csvStudents) {
                                if (csvStudent.status === 'invalid') continue

                                try {
                                    let studentUserId: string | undefined

                                    if (csvStudent.status === 'exists' && csvStudent.existingId) {
                                        studentUserId = csvStudent.existingId
                                    } else if (csvStudent.status === 'new') {
                                        // Create new student
                                        const userResult = await fetchJsonWithCsrf<{ user?: { id: string } }>(
                                            '/api/admin/school/users',
                                            {
                                                method: 'POST',
                                                body: {
                                                    email: csvStudent.email,
                                                    name: csvStudent.name,
                                                    role: 'STUDENT',
                                                    institutionId
                                                }
                                            }
                                        )
                                        studentUserId = userResult?.user?.id
                                    }

                                    if (studentUserId) {
                                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                            method: 'POST',
                                            body: {
                                                userId: studentUserId,
                                                courseId: courseResult.id,
                                                classId: newSectionId,
                                                role: 'STUDENT'
                                            }
                                        })
                                    }
                                } catch (err) {
                                    console.error('Failed to process CSV student for section:', csvStudent.email, err)
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Failed to create section:', section.name, err)
                    }
                }
            }

            // 5. Enroll teachers in the default section
            if (selectedTeacherIds.size > 0 && defaultSectionId) {
                for (const teacherId of selectedTeacherIds) {
                    try {
                        await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                            method: 'POST',
                            body: {
                                userId: teacherId,
                                courseId: courseResult.id,
                                classId: defaultSectionId,
                                role: 'TEACHER'
                            }
                        })
                    } catch (err) {
                        console.error('Failed to enroll teacher:', teacherId, err)
                    }
                }
            }

            // 6. Create new students and enroll them
            if (defaultSectionId) {
                for (const student of csvStudents) {
                    if (student.status === 'invalid') continue

                    try {
                        if (student.status === 'new') {
                            // Create user and enroll
                            const userResult = await fetchJsonWithCsrf<{ user?: { id: string } }>(
                                '/api/admin/school/users',
                                {
                                    method: 'POST',
                                    body: {
                                        email: student.email,
                                        name: student.name,
                                        role: 'STUDENT',
                                        institutionId
                                    }
                                }
                            )
                            if (userResult?.user) {
                                await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                    method: 'POST',
                                    body: {
                                        userId: userResult.user.id,
                                        courseId: courseResult.id,
                                        classId: defaultSectionId,
                                        role: 'STUDENT'
                                    }
                                })
                            }
                        } else if (student.status === 'exists' && student.existingId) {
                            // Just enroll existing student
                            await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                                method: 'POST',
                                body: {
                                    userId: student.existingId,
                                    courseId: courseResult.id,
                                    classId: defaultSectionId,
                                    role: 'STUDENT'
                                }
                            })
                        }
                    } catch (err) {
                        console.error('Failed to process student:', student.email, err)
                    }
                }
            }

            onSave(courseResult, defaultSectionId)
            onClose()
        } catch (err) {
            console.error('Save course failed:', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    const newStudentsCount = csvStudents.filter(s => s.status === 'new').length
    const existingStudentsCount = csvStudents.filter(s => s.status === 'exists').length
    const invalidStudentsCount = csvStudents.filter(s => s.status === 'invalid').length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Confirmation dialog for deleting a section */}
            {sectionToDelete && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {dict.classes.deleteSectionConfirm}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Etes-vous sur de vouloir supprimer la section <strong>{sectionToDelete.name}</strong> ?
                            Cette action deplacera les inscriptions vers la section par defaut.
                        </p>
                        <Inline gap="sm" align="end">
                            <Button
                                variant="secondary"
                                onClick={cancelDeleteExistingSection}
                            >
                                {dict.cancelArchiveButton}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmDeleteExistingSection}
                            >
                                {dict.confirmArchiveButton}
                            </Button>
                        </Inline>
                    </div>
                </div>
            )}

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <Text as="h2" variant="pageTitle" className="text-xl">
                        {editCourse ? dict.editCourseTitle || 'Modifier le cours' : dict.createCourseTitle}
                    </Text>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="p-2"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
                    <Button
                        onClick={() => setActiveTab('info')}
                        className={cn(
                            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap rounded-none',
                            activeTab === 'info'
                                ? 'border-brand-900 text-brand-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        Informations
                    </Button>
                    <Button
                        onClick={() => setActiveTab('sections')}
                        className={cn(
                            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap rounded-none',
                            activeTab === 'sections'
                                ? 'border-brand-900 text-brand-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        Sections
                        {(courseExistingSections.length + sectionsToCreate.length) > 0 && (
                            <Badge variant="info" className="text-xs">
                                {courseExistingSections.length + sectionsToCreate.length}
                            </Badge>
                        )}
                    </Button>
                    <Button
                        onClick={() => setActiveTab('teachers')}
                        className={cn(
                            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap rounded-none',
                            activeTab === 'teachers'
                                ? 'border-brand-900 text-brand-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Professeurs
                        {selectedTeacherIds.size > 0 && (
                            <Badge variant="info" className="text-xs">
                                {selectedTeacherIds.size}
                            </Badge>
                        )}
                    </Button>
                    <Button
                        onClick={() => setActiveTab('students')}
                        className={cn(
                            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap rounded-none',
                            activeTab === 'students'
                                ? 'border-brand-900 text-brand-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Etudiants
                        {csvStudents.length > 0 && (
                            <Badge variant="info" className="text-xs">
                                {csvStudents.length}
                            </Badge>
                        )}
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Info Tab */}
                    {activeTab === 'info' && (
                        <Stack gap="md">
                            <Stack gap="xs">
                                <Text as="label" variant="label" htmlFor="course-code">
                                    {dict.courseCodePlaceholder} *
                                </Text>
                                <Input
                                    id="course-code"
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="ex: INF101"
                                />
                            </Stack>
                            <Stack gap="xs">
                                <Text as="label" variant="label" htmlFor="course-name">
                                    {dict.courseNamePlaceholder} *
                                </Text>
                                <Input
                                    id="course-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="ex: Introduction a l'informatique"
                                />
                            </Stack>
                            <Stack gap="xs">
                                <Text as="label" variant="label" htmlFor="course-description">
                                    Description (optionnel)
                                </Text>
                                <Textarea
                                    id="course-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Description du cours..."
                                />
                            </Stack>
                        </Stack>
                    )}

                    {/* Sections Tab */}
                    {activeTab === 'sections' && (
                        <Stack gap="md">
                            <Text variant="caption">
                                {editCourse
                                    ? 'Gerez les sections (groupes) de ce cours.'
                                    : 'Ajoutez des sections (groupes) pour organiser les etudiants du cours. Une section par defaut sera creee automatiquement.'
                                }
                            </Text>

                            {/* Add section input */}
                            <Inline gap="sm">
                                <Input
                                    type="text"
                                    value={newSectionName}
                                    onChange={(e) => setNewSectionName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addSection()
                                        }
                                    }}
                                    placeholder="Nom de la section (ex: Groupe A, TD1...)"
                                    className="flex-1"
                                />
                                <Button
                                    variant="primary"
                                    onClick={addSection}
                                    disabled={!newSectionName.trim()}
                                >
                                    <Plus className="w-4 h-4" />
                                    Ajouter
                                </Button>
                            </Inline>

                            {/* Existing sections (edit mode only) */}
                            {editCourse && courseExistingSections.length > 0 && (
                                <Stack gap="sm">
                                    <Text variant="overline">
                                        Sections existantes
                                    </Text>
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                                        {courseExistingSections.map((section) => {
                                            const { teacherCount, studentCount } = getExistingSectionCounts(section)
                                            const isEditing = editingSectionId === section.id
                                            const displayName = getSectionDisplayName(section)
                                            const isRenamed = renamedSections.has(section.id)
                                            const isExpanded = expandedExistingSectionId === section.id
                                            const changes = sectionEnrollmentChanges.get(section.id)
                                            const hasChanges = changes && (
                                                changes.addedTeacherIds.size > 0 ||
                                                changes.removedTeacherIds.size > 0 ||
                                                changes.addedStudentIds.size > 0 ||
                                                changes.removedStudentIds.size > 0 ||
                                                changes.csvStudents.length > 0
                                            )

                                            return (
                                                <div key={section.id} className="bg-white">
                                                    {/* Section header */}
                                                    <div
                                                        className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}
                                                        onClick={() => !isEditing && setExpandedExistingSectionId(isExpanded ? null : section.id)}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex-shrink-0">
                                                                <Layers className="w-3 h-3" />
                                                            </span>
                                                            {isEditing ? (
                                                                <Inline gap="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
                                                                    <Input
                                                                        type="text"
                                                                        value={editingSectionName}
                                                                        onChange={(e) => setEditingSectionName(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') saveEditingSection()
                                                                            if (e.key === 'Escape') cancelEditingSection()
                                                                        }}
                                                                        className="flex-1"
                                                                        autoFocus
                                                                        size="sm"
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        onClick={saveEditingSection}
                                                                        className="text-green-600 hover:bg-green-50"
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        onClick={cancelEditingSection}
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </Button>
                                                                </Inline>
                                                            ) : (
                                                                <>
                                                                    <span className="font-medium text-gray-900 truncate">
                                                                        {displayName}
                                                                    </span>
                                                                    {isRenamed && (
                                                                        <Badge variant="warning">modifie</Badge>
                                                                    )}
                                                                    {hasChanges && (
                                                                        <Badge variant="info">inscriptions modifiees</Badge>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                        {!isEditing && (
                                                            <div className="flex items-center gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                                                                <span className="text-xs text-gray-500 flex-shrink-0">
                                                                    {teacherCount} prof · {studentCount} etud.
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={() => startEditingSection(section.id, displayName)}
                                                                    title="Renommer"
                                                                    className="hover:text-brand-600 hover:bg-brand-50"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={() => askDeleteExistingSection(section.id, displayName)}
                                                                    title={dict.classes.deleteSectionConfirm}
                                                                    className="hover:text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Expanded enrollment panel */}
                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                                                            {/* Teachers selection */}
                                                            <div className="pt-3 mb-4">
                                                                <h5 className="text-xs font-medium text-gray-700 mb-2">
                                                                    Professeurs ({teacherCount})
                                                                </h5>
                                                                <div className="border border-gray-200 rounded-lg max-h-28 overflow-y-auto bg-white">
                                                                    {teachers.length === 0 ? (
                                                                        <p className="p-2 text-xs text-gray-400">{dict.classes.emptyTeachersDropdown}</p>
                                                                    ) : (
                                                                        teachers.map(teacher => {
                                                                            const isCurrentlyEnrolled = section.enrollments.some(e => e.user.id === teacher.id && e.role === 'TEACHER')
                                                                            const isChecked = isTeacherInExistingSection(section, teacher.id)
                                                                            return (
                                                                                <label
                                                                                    key={teacher.id}
                                                                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-900"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => toggleExistingSectionTeacher(section.id, teacher.id, isCurrentlyEnrolled)}
                                                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                                                                    />
                                                                                    <span className="truncate font-medium">{teacher.name || teacher.email}</span>
                                                                                </label>
                                                                            )
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Students */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <h5 className="text-xs font-medium text-gray-700">
                                                                        Etudiants ({studentCount})
                                                                    </h5>
                                                                    <label className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 rounded cursor-pointer hover:bg-brand-100">
                                                                        <Upload className="w-3 h-3" />
                                                                        Importer CSV
                                                                        <input
                                                                            type="file"
                                                                            accept=".csv,.txt"
                                                                            onChange={(e) => handleExistingSectionCsvUpload(section.id, e)}
                                                                            className="hidden"
                                                                        />
                                                                    </label>
                                                                </div>

                                                                {/* CSV imported students for existing section */}
                                                                {changes && changes.csvStudents.length > 0 && (
                                                                    <div className="mb-2">
                                                                        <Inline gap="sm" align="between">
                                                                            <Text variant="xsMuted">
                                                                                {changes.csvStudents.filter(s => s.status === 'new').length} nouveaux,{' '}
                                                                                {changes.csvStudents.filter(s => s.status === 'exists').length} existants
                                                                                {changes.csvStudents.filter(s => s.status === 'invalid').length > 0 && (
                                                                                    <span className="text-red-500">
                                                                                        , {changes.csvStudents.filter(s => s.status === 'invalid').length} invalides
                                                                                    </span>
                                                                                )}
                                                                            </Text>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="xs"
                                                                                onClick={() => clearExistingSectionCsvStudents(section.id)}
                                                                                className="hover:text-red-600"
                                                                            >
                                                                                Effacer
                                                                            </Button>
                                                                        </Inline>
                                                                        <div className="border border-gray-200 rounded-lg max-h-24 overflow-y-auto divide-y divide-gray-100 bg-white">
                                                                            {changes.csvStudents.map(csvStudent => (
                                                                                <div
                                                                                    key={csvStudent.email}
                                                                                    className={`flex items-center justify-between px-2 py-1 text-xs ${
                                                                                        csvStudent.status === 'invalid' ? 'bg-red-50' :
                                                                                        csvStudent.status === 'new' ? 'bg-green-50' : 'bg-blue-50'
                                                                                    }`}
                                                                                >
                                                                                    <span className="truncate flex-1">{csvStudent.email}</span>
                                                                                    <div className="flex items-center gap-1.5 ml-2">
                                                                                        <Badge
                                                                                            variant={
                                                                                                csvStudent.status === 'invalid' ? 'warning' :
                                                                                                csvStudent.status === 'new' ? 'success' : 'info'
                                                                                            }
                                                                                            className="text-[10px]"
                                                                                        >
                                                                                            {csvStudent.status === 'new' ? 'nouveau' :
                                                                                             csvStudent.status === 'exists' ? 'existant' : 'invalide'}
                                                                                        </Badge>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="xs"
                                                                                            onClick={() => removeExistingSectionCsvStudent(section.id, csvStudent.email)}
                                                                                            className="hover:text-red-600 p-0"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Existing students selection */}
                                                                {existingStudents.length > 0 && (
                                                                    <details className="text-sm">
                                                                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 mb-1 font-medium">
                                                                            Gerer les etudiants existants
                                                                        </summary>
                                                                        <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto bg-white">
                                                                            {existingStudents.slice(0, 50).map(student => {
                                                                                const isCurrentlyEnrolled = section.enrollments.some(e => e.user.id === student.id && e.role === 'STUDENT')
                                                                                const isChecked = isStudentInExistingSection(section, student.id)
                                                                                return (
                                                                                    <label
                                                                                        key={student.id}
                                                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-900"
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            onChange={() => toggleExistingSectionStudent(section.id, student.id, isCurrentlyEnrolled)}
                                                                                            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                                                                        />
                                                                                        <span className="truncate font-medium">{student.name || student.email}</span>
                                                                                        {isCurrentlyEnrolled && (
                                                                                            <span className="text-xs text-gray-500 ml-1">(inscrit)</span>
                                                                                        )}
                                                                                    </label>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </details>
                                                                )}

                                                                {existingStudents.length === 0 && (!changes || changes.csvStudents.length === 0) && (
                                                                    <p className="text-xs text-gray-400 italic">
                                                                        Importez un fichier CSV (email,nom) pour ajouter des etudiants
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Stack>
                            )}

                            {/* New sections to create */}
                            {sectionsToCreate.length > 0 && (
                                <Stack gap="sm">
                                    <Text variant="overline">
                                        Nouvelles sections
                                    </Text>
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                                        {sectionsToCreate.map((section, index) => {
                                            const isExpanded = expandedSectionId === section.id
                                            return (
                                                <div key={section.id} className="bg-green-50">
                                                    {/* Section header */}
                                                    <div
                                                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-green-100 transition-colors"
                                                        onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                                {index + 1}
                                                            </span>
                                                            <span className="font-medium text-gray-900">
                                                                {section.name}
                                                            </span>
                                                            <Badge variant="success">nouveau</Badge>
                                                            {(section.teacherIds.length > 0 || section.studentIds.length > 0 || section.csvStudents.length > 0) && (
                                                                <span className="text-xs text-gray-500">
                                                                    ({section.teacherIds.length} prof, {section.studentIds.length + section.csvStudents.filter(s => s.status !== 'invalid').length} etud.)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                removeSection(section.id)
                                                            }}
                                                            className="hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    {/* Expanded enrollment panel */}
                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 bg-white border-t border-green-200">
                                                            {/* Teachers selection */}
                                                            <div className="pt-3 mb-4">
                                                                <h5 className="text-xs font-medium text-gray-700 mb-2">
                                                                    Professeurs ({section.teacherIds.length})
                                                                </h5>
                                                                <div className="border border-gray-200 rounded-lg max-h-28 overflow-y-auto">
                                                                    {teachers.length === 0 ? (
                                                                        <p className="p-2 text-xs text-gray-400">{dict.classes.emptyTeachersDropdown}</p>
                                                                    ) : (
                                                                        teachers.map(teacher => (
                                                                            <label
                                                                                key={teacher.id}
                                                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-900"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={section.teacherIds.includes(teacher.id)}
                                                                                    onChange={() => toggleSectionTeacher(section.id, teacher.id)}
                                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                                                                />
                                                                                <span className="truncate font-medium">{teacher.name || teacher.email}</span>
                                                                            </label>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Students - CSV Import */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <h5 className="text-xs font-medium text-gray-700">
                                                                        Etudiants ({section.studentIds.length + section.csvStudents.filter(s => s.status !== 'invalid').length})
                                                                    </h5>
                                                                    <label className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 rounded cursor-pointer hover:bg-brand-100">
                                                                        <Upload className="w-3 h-3" />
                                                                        Importer CSV
                                                                        <input
                                                                            type="file"
                                                                            accept=".csv,.txt"
                                                                            onChange={(e) => handleSectionCsvUpload(section.id, e)}
                                                                            className="hidden"
                                                                        />
                                                                    </label>
                                                                </div>

                                                                {/* CSV imported students */}
                                                                {section.csvStudents.length > 0 && (
                                                                    <div className="mb-2">
                                                                        <Inline gap="sm" align="between">
                                                                            <Text variant="xsMuted">
                                                                                {section.csvStudents.filter(s => s.status === 'new').length} nouveaux,{' '}
                                                                                {section.csvStudents.filter(s => s.status === 'exists').length} existants
                                                                                {section.csvStudents.filter(s => s.status === 'invalid').length > 0 && (
                                                                                    <span className="text-red-500">
                                                                                        , {section.csvStudents.filter(s => s.status === 'invalid').length} invalides
                                                                                    </span>
                                                                                )}
                                                                            </Text>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="xs"
                                                                                onClick={() => clearSectionCsvStudents(section.id)}
                                                                                className="hover:text-red-600"
                                                                            >
                                                                                Effacer
                                                                            </Button>
                                                                        </Inline>
                                                                        <div className="border border-gray-200 rounded-lg max-h-24 overflow-y-auto divide-y divide-gray-100">
                                                                            {section.csvStudents.map(csvStudent => (
                                                                                <div
                                                                                    key={csvStudent.email}
                                                                                    className={`flex items-center justify-between px-2 py-1 text-xs ${
                                                                                        csvStudent.status === 'invalid' ? 'bg-red-50' :
                                                                                        csvStudent.status === 'new' ? 'bg-green-50' : 'bg-blue-50'
                                                                                    }`}
                                                                                >
                                                                                    <span className="truncate flex-1">{csvStudent.email}</span>
                                                                                    <div className="flex items-center gap-1.5 ml-2">
                                                                                        <Badge
                                                                                            variant={
                                                                                                csvStudent.status === 'invalid' ? 'warning' :
                                                                                                csvStudent.status === 'new' ? 'success' : 'info'
                                                                                            }
                                                                                            className="text-[10px]"
                                                                                        >
                                                                                            {csvStudent.status === 'new' ? 'nouveau' :
                                                                                             csvStudent.status === 'exists' ? 'existant' : 'invalide'}
                                                                                        </Badge>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="xs"
                                                                                            onClick={() => removeSectionCsvStudent(section.id, csvStudent.email)}
                                                                                            className="hover:text-red-600 p-0"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Existing students selection */}
                                                                {existingStudents.length > 0 && (
                                                                    <details className="text-sm">
                                                                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 mb-1 font-medium">
                                                                            Selectionner des etudiants existants ({section.studentIds.length} selectionnes)
                                                                        </summary>
                                                                        <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto bg-white">
                                                                            {existingStudents.slice(0, 50).map(student => (
                                                                                <label
                                                                                    key={student.id}
                                                                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-900"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={section.studentIds.includes(student.id)}
                                                                                        onChange={() => toggleSectionStudent(section.id, student.id)}
                                                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                                                                    />
                                                                                    <span className="truncate font-medium">{student.name || student.email}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </details>
                                                                )}

                                                                {section.csvStudents.length === 0 && existingStudents.length === 0 && (
                                                                    <p className="text-xs text-gray-400 italic">
                                                                        Importez un fichier CSV (email,nom) pour ajouter des etudiants
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Stack>
                            )}

                            {/* Empty state */}
                            {!editCourse && sectionsToCreate.length === 0 && (
                                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                                    {dict.classes.noAdditionalSections}
                                    Les professeurs et etudiants seront inscrits dans la section par defaut.
                                </div>
                            )}

                            {editCourse && courseExistingSections.length === 0 && sectionsToCreate.length === 0 && (
                                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                                    {dict.classes.noSectionsForCourse}
                                    Utilisez le champ ci-dessus pour en ajouter.
                                </div>
                            )}
                        </Stack>
                    )}

                    {/* Teachers Tab */}
                    {activeTab === 'teachers' && (
                        <Stack gap="md">
                            <Input
                                type="text"
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                placeholder={dict.searchTeachersPlaceholder}
                            />

                            {filteredTeachers.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    {dict.emptyTeachers}
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                                    {filteredTeachers.map(teacher => (
                                        <label
                                            key={teacher.id}
                                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedTeacherIds.has(teacher.id)}
                                                onChange={() => toggleTeacher(teacher.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">
                                                    {teacher.name || 'Sans nom'}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    {teacher.email}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {selectedTeacherIds.size > 0 && (
                                <div className="text-sm text-gray-600">
                                    {selectedTeacherIds.size} professeur{selectedTeacherIds.size > 1 ? 's' : ''} selectionne{selectedTeacherIds.size > 1 ? 's' : ''}
                                </div>
                            )}
                        </Stack>
                    )}

                    {/* Students Tab */}
                    {activeTab === 'students' && (
                        <Stack gap="md">
                            {/* CSV Upload */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-brand-400 transition-colors">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleCsvUpload}
                                    className="hidden"
                                />
                                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <Button
                                    variant="primary"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-4 h-4" />
                                    Importer un fichier CSV
                                </Button>
                                <Text variant="caption" className="mt-3">
                                    Format attendu: email,nom (une ligne par etudiant)
                                </Text>
                                <Text variant="xsMuted" className="mt-1">
                                    Separateur: virgule ou point-virgule
                                </Text>
                            </div>

                            {csvError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {csvError}
                                </div>
                            )}

                            {/* Preview */}
                            {csvStudents.length > 0 && (
                                <>
                                    {/* Stats */}
                                    <div className="flex gap-4 text-sm">
                                        {newStudentsCount > 0 && (
                                            <div className="flex items-center gap-1.5 text-green-700">
                                                <CheckCircle className="w-4 h-4" />
                                                {newStudentsCount} nouveau{newStudentsCount > 1 ? 'x' : ''}
                                            </div>
                                        )}
                                        {existingStudentsCount > 0 && (
                                            <div className="flex items-center gap-1.5 text-blue-700">
                                                <Users className="w-4 h-4" />
                                                {existingStudentsCount} existant{existingStudentsCount > 1 ? 's' : ''}
                                            </div>
                                        )}
                                        {invalidStudentsCount > 0 && (
                                            <div className="flex items-center gap-1.5 text-red-600">
                                                <AlertCircle className="w-4 h-4" />
                                                {invalidStudentsCount} invalide{invalidStudentsCount > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* List */}
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                                        {csvStudents.map(student => (
                                            <div
                                                key={student.email}
                                                className={`flex items-center justify-between px-4 py-2 ${
                                                    student.status === 'invalid' ? 'bg-red-50' :
                                                    student.status === 'exists' ? 'bg-blue-50' :
                                                    'bg-green-50'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {student.email}
                                                    </div>
                                                    {student.name && (
                                                        <div className="text-xs text-gray-500 truncate">
                                                            {student.name}
                                                        </div>
                                                    )}
                                                </div>
                                                <Inline gap="sm" className="ml-2">
                                                    <Badge
                                                        variant={
                                                            student.status === 'invalid' ? 'warning' :
                                                            student.status === 'exists' ? 'info' : 'success'
                                                        }
                                                    >
                                                        {student.status === 'invalid' ? 'Invalide' :
                                                         student.status === 'exists' ? 'Existant' : 'Nouveau'}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => removeStudent(student.email)}
                                                        className="hover:text-red-600 p-1"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </Inline>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCsvStudents([])}
                                    >
                                        Effacer la liste
                                    </Button>
                                </>
                            )}
                        </Stack>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="px-6 pb-4">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        {dict.cancelArchiveButton}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? dict.saving : (editCourse ? dict.saveButton : dict.createCourseButton)}
                    </Button>
                </div>
            </div>
        </div>
    )
}
