import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from './cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    size?: 'sm' | 'md'
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    size?: 'sm' | 'md'
}

const inputBase =
    'w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2'

const inputSize = {
    sm: 'h-9',
    md: 'h-10',
}

const textareaBase =
    'min-h-[96px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2'

export function Input({ className, size = 'md', ...props }: InputProps) {
    return <input className={cn(inputBase, inputSize[size], className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaProps) {
    return <textarea className={cn(textareaBase, className)} {...props} />
}

export function Select({ className, size = 'md', ...props }: SelectProps) {
    return <select className={cn(inputBase, inputSize[size], className)} {...props} />
}
