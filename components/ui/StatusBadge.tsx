import { Badge } from './Badge'

type StatusBadgeVariant = 'draft' | 'scheduled' | 'published'

type StatusBadgeProps = {
    label: string
    variant: StatusBadgeVariant
}

const variantMap: Record<StatusBadgeVariant, { badge: 'neutral' | 'info' | 'success' | 'warning' }> = {
    draft: { badge: 'warning' },
    scheduled: { badge: 'info' },
    published: { badge: 'success' },
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
    const mapped = variantMap[variant]
    return <Badge variant={mapped.badge}>{label}</Badge>
}
