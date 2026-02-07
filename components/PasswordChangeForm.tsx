'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import { Lock, Loader2 } from 'lucide-react'
import { validateFields, required, minLength, matches } from '@/lib/validation'

type PasswordChangeDictionary = {
    title: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    submit: string
    success: string
    errorMismatch: string
    errorTooShort: string
    errorInvalidCurrent: string
    errorGeneric: string
    errorSsoOnly: string
}

const FR: PasswordChangeDictionary = {
    title: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le nouveau mot de passe',
    submit: 'Mettre à jour',
    success: 'Mot de passe mis à jour avec succès',
    errorMismatch: 'Les mots de passe ne correspondent pas',
    errorTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
    errorInvalidCurrent: 'Mot de passe actuel incorrect',
    errorGeneric: 'Erreur lors du changement de mot de passe',
    errorSsoOnly: 'Changement de mot de passe non disponible (connexion SSO)',
}

const EN: PasswordChangeDictionary = {
    title: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    submit: 'Update',
    success: 'Password updated successfully',
    errorMismatch: 'Passwords do not match',
    errorTooShort: 'Password must be at least 8 characters',
    errorInvalidCurrent: 'Invalid current password',
    errorGeneric: 'Error changing password',
    errorSsoOnly: 'Password change not available (SSO login)',
}

export function PasswordChangeForm({ locale = 'fr' }: { locale?: string }) {
    const t = locale === 'en' ? EN : FR
    const { toast } = useToast()

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        const { errors, valid } = validateFields(
            { currentPassword, newPassword, confirmPassword },
            {
                currentPassword: [required(t.errorGeneric)],
                newPassword: [required(t.errorGeneric), minLength(8, t.errorTooShort)],
                confirmPassword: [matches(newPassword, t.errorMismatch)],
            }
        )
        if (!valid) {
            const firstError = errors.confirmPassword || errors.newPassword || errors.currentPassword
            if (firstError) toast(firstError, 'error')
            return
        }

        setIsSubmitting(true)
        try {
            await fetchJsonWithCsrf('/api/auth/change-password', {
                method: 'POST',
                body: { currentPassword, newPassword },
            })
            toast(t.success, 'success')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            const message = err instanceof Error ? err.message : ''
            if (message.includes('403')) {
                toast(t.errorInvalidCurrent, 'error')
            } else if (message.includes('not available')) {
                toast(t.errorSsoOnly, 'error')
            } else {
                toast(t.errorGeneric, 'error')
            }
        } finally {
            setIsSubmitting(false)
        }
    }, [currentPassword, newPassword, confirmPassword, t, toast])

    const isValid = currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-8">
            <div className="px-4 py-5 sm:px-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg leading-6 font-medium text-gray-900">{t.title}</h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                    <div>
                        <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                            {t.currentPassword}
                        </label>
                        <Input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                            {t.newPassword}
                        </label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                            {t.confirmPassword}
                        </label>
                        <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" disabled={!isValid || isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t.submit}...
                            </>
                        ) : (
                            t.submit
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
