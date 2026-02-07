'use client'

import { useExamStore } from './store'
import { Surface, Stack, Inline } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { X } from 'lucide-react'

interface ExamSettingsPanelProps {
  onClose: () => void
}

export default function ExamSettingsPanel({ onClose }: ExamSettingsPanelProps) {
  const exam = useExamStore((state) => state.exam)
  const updateAntiCheatConfig = useExamStore((state) => state.updateAntiCheatConfig)

  if (!exam) return null

  const antiCheatConfig = exam.antiCheatConfig || { webcamDeterrent: false, browserLockdown: false }

  const handleToggleWebcam = () => {
    updateAntiCheatConfig({ webcamDeterrent: !antiCheatConfig.webcamDeterrent })
  }

  const handleToggleBrowserLockdown = () => {
    updateAntiCheatConfig({ browserLockdown: !antiCheatConfig.browserLockdown })
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-96">
      <Surface className="p-4 shadow-xl">
        <Stack gap="md">
          {/* Header */}
          <Inline align="between" wrap="nowrap">
            <Text variant="sectionTitle">Parametres de surveillance</Text>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
              <X className="w-4 h-4" />
            </Button>
          </Inline>

          {/* Webcam Deterrent Setting */}
          <Stack gap="xs">
            <Inline align="between" wrap="nowrap">
              <label htmlFor="webcam-toggle" className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  id="webcam-toggle"
                  checked={antiCheatConfig.webcamDeterrent}
                  onChange={handleToggleWebcam}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
                />
                <Text variant="label" className="flex-1">Camera de dissuasion</Text>
              </label>
            </Inline>
            <Text variant="muted" className="ml-7">
              Demande l'autorisation camera a l'etudiant. La camera est activee comme moyen de dissuasion uniquement (aucun enregistrement, aucune capture).
            </Text>
          </Stack>

          {/* Browser Lockdown Setting */}
          <Stack gap="xs">
            <Inline align="between" wrap="nowrap">
              <label htmlFor="lockdown-toggle" className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  id="lockdown-toggle"
                  checked={antiCheatConfig.browserLockdown}
                  onChange={handleToggleBrowserLockdown}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
                />
                <Text variant="label" className="flex-1">Verrouillage navigateur</Text>
              </label>
            </Inline>
            <Text variant="muted" className="ml-7">
              Detecte les changements d'onglet, les pertes de focus et les collages depuis des sources externes.
            </Text>
          </Stack>
        </Stack>
      </Surface>
    </div>
  )
}
