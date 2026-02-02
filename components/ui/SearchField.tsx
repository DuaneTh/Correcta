import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { Input } from './Form'

type SearchFieldProps = InputHTMLAttributes<HTMLInputElement>

export function SearchField({ placeholder, value, onChange, ...props }: SearchFieldProps) {
    return (
        <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="pl-10 sm:text-sm"
                {...props}
            />
        </div>
    )
}
