import Link from 'next/link'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card, CardBody, CardHeader } from './Card'
import { Input, Select, Textarea } from './Form'

const colorSwatches = [
    { label: 'Brand 900', className: 'bg-brand-900', text: '#000040' },
    { label: 'Brand 700', className: 'bg-brand-700', text: '#1a1a66' },
    { label: 'Brand 50', className: 'bg-brand-50 border border-gray-200', text: '#f3f3ff' },
    { label: 'Gray 900', className: 'bg-gray-900', text: 'text-gray-900' },
    { label: 'Gray 700', className: 'bg-gray-700', text: 'text-gray-700' },
    { label: 'Gray 500', className: 'bg-gray-500', text: 'text-gray-500' },
    { label: 'Gray 200', className: 'bg-gray-200', text: 'border-gray-200' },
    { label: 'Gray 100', className: 'bg-gray-100', text: 'bg-gray-100' },
]

const badgeSamples = [
    { label: 'Draft', variant: 'neutral' as const },
    { label: 'Scheduled', variant: 'info' as const },
    { label: 'Published', variant: 'success' as const },
    { label: 'Archived', variant: 'warning' as const },
]

const tableCell = 'px-4 py-2 text-sm text-gray-700'

export default function UiKitReference() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-6 py-10">
                <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                            UI Reference
                        </p>
                        <h1 className="text-3xl font-semibold text-gray-900">Design System Starter</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-600">
                            Palette, components, and patterns used across Correcta. Use this as a
                            reference to build consistent UI and validate existing screens.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/"
                            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                        >
                            Back to app
                        </Link>
                    </div>
                </div>

                <div className="space-y-12">
                    <Card>
                        <CardBody>
                            <CardHeader>
                                <h2 className="text-lg font-semibold text-gray-900">Colors</h2>
                                <span className="text-xs text-gray-500">Tailwind tokens</span>
                            </CardHeader>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {colorSwatches.map((swatch) => (
                                    <div key={swatch.label} className="rounded-lg border border-gray-200 bg-white p-3">
                                        <div className={`h-12 w-full rounded-md ${swatch.className}`} />
                                        <div className="mt-3">
                                            <p className="text-sm font-medium text-gray-900">{swatch.label}</p>
                                            <p className="text-xs text-gray-500">{swatch.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Typography</h2>
                            <div className="mt-4 space-y-3">
                                <p className="text-3xl font-semibold text-gray-900">Page title (text-3xl)</p>
                                <p className="text-xl font-semibold text-gray-900">Section title (text-xl)</p>
                                <p className="text-base font-medium text-gray-900">Body (text-base)</p>
                                <p className="text-sm text-gray-600">Secondary text (text-sm)</p>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Caption / Overline</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Buttons & Links</h2>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Button>Primary Action</Button>
                                <Button variant="secondary">Secondary Action</Button>
                                <Button variant="ghost">Ghost Action</Button>
                                <Button variant="destructive">Destructive</Button>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-900 hover:text-brand-700"
                                >
                                    Inline link
                                </button>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Forms</h2>
                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Text input</label>
                                    <Input placeholder="Placeholder" aria-label="Text input" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Select</label>
                                    <Select aria-label="Select">
                                        <option>Option 1</option>
                                        <option>Option 2</option>
                                    </Select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Textarea</label>
                                    <Textarea placeholder="Write something..." aria-label="Textarea" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Checkbox</label>
                                    <div className="mt-2 flex items-center gap-2">
                                        <input id="checkbox" type="checkbox" className="h-4 w-4" />
                                        <label htmlFor="checkbox" className="text-sm text-gray-600">
                                            Label text
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Radio</label>
                                    <div className="mt-2 space-y-2">
                                        <label className="flex items-center gap-2 text-sm text-gray-600">
                                            <input type="radio" name="radio" className="h-4 w-4" />
                                            Option A
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-600">
                                            <input type="radio" name="radio" className="h-4 w-4" />
                                            Option B
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Badges</h2>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {badgeSamples.map((badge) => (
                                    <Badge key={badge.label} variant={badge.variant}>
                                        {badge.label}
                                    </Badge>
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Cards</h2>
                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <Badge className="border border-brand-900/40 bg-white text-brand-900">CODE101</Badge>
                                        <Button size="sm">Primary CTA</Button>
                                    </div>
                                    <h3 className="mt-3 text-lg font-semibold text-gray-900">Course card</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Compact description of the card with metadata.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-semibold text-gray-900">Empty state</h3>
                                        <span className="text-xs text-gray-400">Hint</span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600">
                                        Aucune donnee pour le moment. Ajoutez votre premiere entree.
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Tables</h2>
                            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200 text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Column A
                                            </th>
                                            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Column B
                                            </th>
                                            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        <tr>
                                            <td className={tableCell}>Row item</td>
                                            <td className={tableCell}>Detail</td>
                                            <td className={tableCell}>
                                                <Badge variant="success">Active</Badge>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className={tableCell}>Row item</td>
                                            <td className={tableCell}>Detail</td>
                                            <td className={tableCell}>
                                                <Badge>Draft</Badge>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    Success: Operation completed.
                                </div>
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Warning: Check the inputs and try again.
                                </div>
                                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    Error: Something went wrong.
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    )
}
