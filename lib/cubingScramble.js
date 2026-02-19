'use client';

// Shared event support helpers for scramble generation.
// Generation itself is done via `/app/api/admin/generate-scrambles/route.js`

export const SUPPORTED_EVENTS = [
    '333',
    '444',
    '555',
    '666',
    '777',
    '222',
    '333bf',
    '333fm',
    '333oh',
    'clock',
    'minx',
    'pyram',
    'skewb',
    'sq1',
    '444bf',
    '555bf',
    '333mbf',
];

export const SCRAMBLE_COUNT = 5;

export function isEventSupported(eventId) {
    return SUPPORTED_EVENTS.includes(eventId);
}

export function getUnsupportedEvents(eventIds) {
    return (eventIds || []).filter((e) => !SUPPORTED_EVENTS.includes(e));
}