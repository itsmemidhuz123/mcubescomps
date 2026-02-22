'use client';

import { ShieldCheck } from 'lucide-react';

export function VerifiedBadge({ size = 'default', showLabel = true, className = '' }) {
    const sizeClasses = {
        sm: 'text-xs px-1.5 py-0.5',
        default: 'text-xs px-2 py-1',
        lg: 'text-sm px-3 py-1.5'
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        default: 'w-3.5 h-3.5',
        lg: 'w-4 h-4'
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium border border-green-200 dark:border-green-800 ${sizeClasses[size]} ${className}`}
        >
            <ShieldCheck className={iconSizes[size]} />
            {showLabel && <span>Verified Competitor</span>}
        </span>
    );
}

export function VerificationStatusBadge({ status, size = 'default' }) {
    const statusConfig = {
        UNVERIFIED: {
            label: 'Unverified',
            className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
        },
        PENDING: {
            label: 'Pending',
            className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
        },
        VERIFIED: {
            label: 'Verified',
            className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
        },
        REJECTED: {
            label: 'Rejected',
            className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
        },
        BLOCKED: {
            label: 'Blocked',
            className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
        }
    };

    const config = statusConfig[status] || statusConfig.UNVERIFIED;

    const sizeClasses = {
        sm: 'text-[10px] px-1.5 py-0.5',
        default: 'text-xs px-2 py-1',
        lg: 'text-sm px-3 py-1.5'
    };

    return (
        <span
            className={`inline-flex items-center rounded-full font-medium border ${sizeClasses[size]} ${config.className}`}
        >
            {status === 'VERIFIED' && <ShieldCheck className="w-3 h-3 mr-1" />}
            {config.label}
        </span>
    );
}
